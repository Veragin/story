import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { TChangeEvent, TDiagnosticDto, TReferenceDto } from '@story/visualizer-protocol';
import { format, resolveConfig, type Options } from 'prettier';
import { IndentationText, Project, QuoteKind, type SourceFile, ts } from 'ts-morph';
import type { EventBus, TTransaction } from '../events/EventBus';
import { HttpError, isHttpError } from '../http/HttpError';
import { importedNames, isIdentifierUsed, removeImportOf } from './ast';
import { EXAMPLE_STORY_ROOT, REPO_ROOT, type ProjectRoot } from './ProjectRoot';
import { diagnoseProject, newDiagnostics, syntaxDiagnostic, withFields } from './validate';

/**
 * The one long-lived ts-morph `Project` over a story root's `data/` and `types/` (plan §3,
 * `project/`). Everything that reads or writes `.ts` source goes through it:
 *
 *  - `run(fn)` serialises operations (reads included, since a read may refresh files) and first
 *    brings the in-memory files up to date with the disk: every request stats the (few dozen)
 *    story files and refreshes the ones whose mtime/size/inode changed — hand edits included, with
 *    or without the watcher running. Only changed files are re-parsed.
 *  - `session()` starts a set of in-memory edits. `commit()` formats the changed files with the
 *    repo's prettier config, type-checks the project in memory (`validate.ts`), and only then
 *    writes everything in ONE `bus.transaction` (so it emits one event). On any failure the
 *    in-memory files are rolled back and nothing is written.
 *
 * `@story/shared` and `@story/core` are resolved from the repo (a story folder holds only its
 * `data/` and `types/`); `@story/types` and `@story/data` from the story root.
 */
export class SourceProject {
    readonly root: ProjectRoot;
    readonly ts: Project;
    private readonly stats = new Map<string, string>();
    private queue: Promise<unknown> = Promise.resolve();
    private loaded = false;

    private static readonly instances = new WeakMap<ProjectRoot, SourceProject>();

    /** The shared instance for a project root. */
    static for(root: ProjectRoot): SourceProject {
        let sp = SourceProject.instances.get(root);
        if (!sp) {
            sp = new SourceProject(root);
            SourceProject.instances.set(root, sp);
        }
        return sp;
    }

    constructor(root: ProjectRoot) {
        this.root = root;
        this.ts = new Project({
            skipAddingFilesFromTsConfig: true,
            skipFileDependencyResolution: false,
            compilerOptions: compilerOptionsFor(root),
            manipulationSettings: {
                indentationText: IndentationText.FourSpaces,
                quoteKind: QuoteKind.Single,
                useTrailingCommas: true,
            },
        });
    }

    /** Run `fn` exclusively, after syncing the in-memory files with the disk. */
    run<T>(fn: () => Promise<T> | T): Promise<T> {
        const task = async () => {
            await this.sync();
            return fn();
        };
        const result = this.queue.then(task, task);
        this.queue = result.catch(() => undefined);
        return result;
    }

    /** Absolute paths of every story `.ts` file on disk (`data/**` minus tests and assets, `types/**`). */
    private async listStoryFiles(): Promise<string[]> {
        const out: string[] = [];
        const skip = new Set([path.join(this.root.dataDir, 'test'), path.join(this.root.dataDir, 'assets')]);
        const walk = async (dir: string) => {
            let entries;
            try {
                entries = await readdir(dir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const e of entries) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) {
                    if (e.name === 'node_modules' || skip.has(full)) continue;
                    await walk(full);
                } else if (e.isFile() && e.name.endsWith('.ts') && !e.name.includes('.vistmp')) {
                    out.push(full);
                }
            }
        };
        await walk(this.root.dataDir);
        await walk(this.root.typesDir);
        return out.sort();
    }

    /** Bring the in-memory project up to date with the disk (added, changed, deleted files). */
    async sync(): Promise<void> {
        const files = await this.listStoryFiles();
        const seen = new Set<string>();
        for (const file of files) {
            seen.add(file);
            let key: string;
            try {
                const s = await stat(file);
                key = `${s.mtimeMs}:${s.size}:${s.ino}`;
            } catch {
                continue;
            }
            if (this.stats.get(file) === key && this.ts.getSourceFile(file)) continue;
            this.stats.set(file, key);
            const sf = this.ts.getSourceFile(file);
            if (sf) sf.refreshFromFileSystemSync();
            else this.ts.addSourceFileAtPath(file);
        }
        for (const file of [...this.stats.keys()]) {
            if (seen.has(file)) continue;
            this.stats.delete(file);
            const sf = this.ts.getSourceFile(file);
            if (sf) this.ts.removeSourceFile(sf);
        }
        this.loaded = true;
    }

    /** Record the on-disk state of files the server just wrote, so the next sync skips them. */
    async markWritten(files: string[]) {
        for (const file of files) {
            try {
                const s = await stat(file);
                this.stats.set(file, `${s.mtimeMs}:${s.size}:${s.ino}`);
            } catch {
                this.stats.delete(file);
            }
        }
    }

    get isLoaded() {
        return this.loaded;
    }

    file(abs: string): SourceFile | undefined {
        return this.ts.getSourceFile(abs);
    }

    fileOrThrow(abs: string, what = 'file'): SourceFile {
        const sf = this.file(abs);
        if (!sf) throw HttpError.notFound(`No ${what} ${this.root.rel(abs)}`);
        return sf;
    }

    /** Current text of a story file, or null when it does not exist. */
    text(abs: string): string | null {
        return this.file(abs)?.getFullText() ?? null;
    }

    /** Story source files (under `data/` or `types/`). */
    storyFiles(): SourceFile[] {
        return this.ts.getSourceFiles().filter((sf) => this.isStoryFile(sf.getFilePath()));
    }

    isStoryFile(abs: string) {
        const { dataDir, typesDir } = this.root;
        if (abs.startsWith(path.join(dataDir, 'test') + path.sep)) return false;
        if (abs.startsWith(path.join(dataDir, 'assets') + path.sep)) return false;
        return abs.startsWith(dataDir + path.sep) || abs.startsWith(typesDir + path.sep);
    }

    /** Source files under a directory (recursively). */
    filesUnder(dir: string): SourceFile[] {
        const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
        return this.storyFiles().filter((sf) => sf.getFilePath().startsWith(prefix));
    }

    session(): EditSession {
        return new EditSession(this);
    }

    /** Put files into the given state (`null` = absent) — the rollback / re-apply primitive. */
    applyState(state: Map<string, string | null>) {
        for (const [abs, text] of state) {
            const sf = this.ts.getSourceFile(abs);
            if (text === null) {
                if (sf) this.ts.removeSourceFile(sf);
            } else if (sf) {
                if (sf.getFullText() !== text) sf.replaceWithText(text);
            } else {
                this.ts.createSourceFile(abs, text, { overwrite: true });
            }
        }
    }
}

const compilerOptionsFor = (root: ProjectRoot): ts.CompilerOptions => ({
    // mirrors tsconfig.base.json + the root tsconfig's `paths`
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    allowImportingTsExtensions: true,
    isolatedModules: true,
    moduleDetection: ts.ModuleDetectionKind.Force,
    noEmit: true,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    noFallthroughCasesInSwitch: true,
    useDefineForClassFields: true,
    // no ambient @types: the story does not need node/jsdom types, and it keeps the program small
    types: [],
    baseUrl: root.root,
    paths: {
        '@story/types': [path.join(root.typesDir, 'index.ts')],
        '@story/data': [path.join(root.dataDir, 'index.ts')],
        '@story/data/*': [path.join(root.dataDir, '*')],
        '@story/shared': [path.join(REPO_ROOT, 'shared/src/index.ts')],
        '@story/core': [path.join(REPO_ROOT, 'core/src/index.ts')],
        '@story/ui': [path.join(REPO_ROOT, 'ui/src/index.ts')],
    },
});

let prettierOptions: Promise<Options> | null = null;

/**
 * The repo's prettier config for `.ts`: resolved for a (hypothetical) file in the example story, so
 * the root `.prettierrc` and its `*.ts` override apply and a temp root formats the same.
 */
const tsPrettierOptions = (): Promise<Options> => {
    prettierOptions ??= resolveConfig(path.join(EXAMPLE_STORY_ROOT, 'data', 'source.ts'))
        .then((c) => c ?? {})
        .catch(() => ({}))
        .then((c) => ({ ...c, parser: 'typescript' }));
    return prettierOptions;
};

/** Format TypeScript source with the repo's prettier config. */
export const formatTs = async (text: string): Promise<string> => format(text, await tsPrettierOptions());

type TAfterOp = (tx: TTransaction) => Promise<unknown>;

/**
 * One operation's in-memory edits. Touch files only through `edit` / `create` / `delete` /
 * `deleteDir` so the session knows what to format, validate, write or roll back.
 */
export class EditSession {
    private readonly original = new Map<string, string | null>();
    private readonly deletedDirs = new Set<string>();
    private readonly afterOps: TAfterOp[] = [];
    private done = false;

    constructor(readonly sp: SourceProject) {}

    /** Per edited file: the imported names it used before the session (see `pruneImports`). */
    private readonly usedImports = new Map<string, string[]>();

    private track(abs: string) {
        if (this.original.has(abs)) return;
        this.original.set(abs, this.sp.text(abs));
        const sf = this.sp.file(abs);
        if (sf)
            this.usedImports.set(
                abs,
                [...importedNames(sf)].filter((n) => isIdentifierUsed(sf, n))
            );
    }

    /**
     * Drop imports that this session made unused (a removed child chapter, trigger, sublocation or
     * passage). Imports that were already unused before are the author's and stay.
     */
    private pruneImports() {
        for (const [abs, names] of this.usedImports) {
            const sf = this.sp.file(abs);
            if (!sf) continue;
            for (const name of names) {
                if (importedNames(sf).has(name) && !isIdentifierUsed(sf, name)) removeImportOf(sf, name);
            }
        }
    }

    /** An existing file, to be edited in place. */
    edit(abs: string, what?: string): SourceFile {
        const sf = this.sp.fileOrThrow(abs, what);
        this.track(abs);
        return sf;
    }

    /** Whether this session changed / created / deleted `abs`. */
    touched(abs: string) {
        return this.original.has(abs);
    }

    create(abs: string, text: string): SourceFile {
        if (this.sp.file(abs)) throw HttpError.exists(`${this.sp.root.rel(abs)} already exists`);
        this.track(abs);
        return this.sp.ts.createSourceFile(abs, text, { overwrite: true });
    }

    delete(abs: string) {
        const sf = this.sp.file(abs);
        if (!sf) return;
        this.track(abs);
        this.sp.ts.removeSourceFile(sf);
    }

    /** Delete a directory with everything in it (on disk: `tx.deleteDir`). */
    deleteDir(dir: string) {
        for (const sf of this.sp.filesUnder(dir)) this.delete(sf.getFilePath());
        this.deletedDirs.add(dir);
    }

    /** Extra writes to run inside the transaction (JSON stores through `json/index.ts`). */
    after(op: TAfterOp) {
        this.afterOps.push(op);
    }

    /** Undo every in-memory change. Safe to call more than once. */
    rollback() {
        if (this.done) return;
        this.done = true;
        this.sp.applyState(this.original);
    }

    /**
     * Run the in-memory edits in `fn`; any ts-morph manipulation error (a code snippet that does
     * not parse) becomes a 422, any error at all rolls the session back.
     */
    apply<T>(fn: () => T): T {
        try {
            return fn();
        } catch (e) {
            this.rollback();
            if (isHttpError(e)) throw e;
            const message = (e as Error)?.message ?? String(e);
            if (/syntax error was inserted|Manipulation error/i.test(message)) {
                throw HttpError.invalid([syntaxDiagnostic('', message.split('\n')[0])], 'A code field does not parse');
            }
            throw e;
        }
    }

    /**
     * Format, validate and write. `event` builds the operation's single change event from the
     * written texts. Returns the texts written (absolute path → content; `null` = deleted).
     */
    async commit(
        bus: EventBus,
        event: (texts: Map<string, string | null>) => TChangeEvent | null,
        {
            asReferences,
            fields,
        }: {
            /**
             * For deletes: new type errors mean "still referenced" (a `TItemId` / `TLocationId`
             * literal that no longer type-checks), answered as 409 `referenced` instead of 422.
             */
            asReferences?: (diagnostics: TDiagnosticDto[]) => TReferenceDto[];
            /**
             * The resource's file, to give 422 diagnostics in it a DTO `field` path; `map` turns a
             * source path (`bow.damage`) into the DTO's (`props.damage`).
             */
            fields?: { file: string; map?: (path: string) => string | undefined };
        } = {}
    ) {
        if (this.done) throw new Error('EditSession already finished');
        try {
            this.apply(() => this.pruneImports());
            const next = new Map<string, string | null>();
            for (const [abs, before] of this.original) {
                const sf = this.sp.file(abs);
                if (!sf) {
                    if (before !== null) next.set(abs, null);
                    continue;
                }
                let text = sf.getFullText();
                if (text === before) continue;
                try {
                    text = await formatTs(text);
                } catch (e) {
                    throw HttpError.invalid(
                        [syntaxDiagnostic(this.sp.root.rel(abs), (e as Error).message)],
                        'The change does not parse'
                    );
                }
                if (text === before) continue;
                if (sf.getFullText() !== text) sf.replaceWithText(text);
                next.set(abs, text);
            }
            if (next.size === 0 && this.deletedDirs.size === 0 && this.afterOps.length === 0) {
                this.done = true;
                return next;
            }

            // Validate: new type errors compared with the state on disk.
            const after = diagnoseProject(this.sp);
            if (after.length > 0) {
                this.sp.applyState(this.original);
                const baseline = diagnoseProject(this.sp);
                this.sp.applyState(next);
                const fresh = newDiagnostics(baseline, after);
                if (fresh.length > 0) {
                    if (asReferences) throw HttpError.referenced(asReferences(fresh));
                    throw HttpError.invalid(fields ? withFields(this.sp, fresh, fields.file, fields.map) : fresh);
                }
            }

            await bus.transaction(async (tx) => {
                for (const [abs, text] of next) {
                    if (text === null) {
                        if (![...this.deletedDirs].some((d) => abs.startsWith(d + path.sep))) await tx.deleteFile(abs);
                    } else {
                        await tx.writeFile(abs, text);
                    }
                }
                for (const dir of this.deletedDirs) await tx.deleteDir(dir);
                for (const op of this.afterOps) await op(tx);
                const e = event(next);
                if (e) tx.setEvent(e);
            });
            this.done = true;
            await this.sp.markWritten([...next.keys()]);
            return next;
        } catch (e) {
            this.rollback();
            // whatever reached the disk before a failure is picked up by the next sync
            throw e;
        }
    }
}
