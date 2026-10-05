import type { Stats } from 'node:fs';
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

export class SourceProject {
    readonly root: ProjectRoot;
    readonly ts: Project;
    private readonly stats = new Map<string, string>();
    private queue: Promise<unknown> = Promise.resolve();
    private firstRun: (() => Promise<unknown>) | null = null;

    private static readonly instances = new WeakMap<ProjectRoot, SourceProject>();

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

    // a migration runs once, before the first task sees the files
    onFirstRun(migrate: () => Promise<unknown>) {
        this.firstRun = migrate;
    }

    run<T>(fn: () => Promise<T> | T): Promise<T> {
        const task = async () => {
            await this.sync();
            const migrate = this.firstRun;
            this.firstRun = null;
            if (migrate) await migrate();
            return fn();
        };
        // reads are serialised too, since a read may refresh files
        const result = this.queue.then(task, task);
        this.queue = result.catch(() => undefined);
        return result;
    }

    private async listStoryFiles(): Promise<string[]> {
        const out: string[] = [];
        const skip = new Set(this.excludedDirs());
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

    async sync(): Promise<void> {
        const files = await this.listStoryFiles();
        const seen = new Set<string>();
        for (const file of files) {
            seen.add(file);
            let key: string;
            try {
                key = statKey(await stat(file));
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
    }

    async markWritten(files: string[]) {
        for (const file of files) {
            try {
                this.stats.set(file, statKey(await stat(file)));
            } catch {
                this.stats.delete(file);
            }
        }
    }

    file(abs: string): SourceFile | undefined {
        return this.ts.getSourceFile(abs);
    }

    fileOrThrow(abs: string, what = 'file'): SourceFile {
        const sf = this.file(abs);
        if (!sf) throw HttpError.notFound(`No ${what} ${this.root.rel(abs)}`);
        return sf;
    }

    text(abs: string): string | null {
        return this.file(abs)?.getFullText() ?? null;
    }

    storyFiles(): SourceFile[] {
        return this.ts.getSourceFiles().filter((sf) => this.isStoryFile(sf.getFilePath()));
    }

    private excludedDirs() {
        return [path.join(this.root.dataDir, '__tests__'), path.join(this.root.dataDir, 'assets')];
    }

    isStoryFile(abs: string) {
        const { dataDir, typesDir } = this.root;
        if (this.excludedDirs().some((dir) => abs.startsWith(dir + path.sep))) return false;
        return abs.startsWith(dataDir + path.sep) || abs.startsWith(typesDir + path.sep);
    }

    filesUnder(dir: string): SourceFile[] {
        const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
        return this.storyFiles().filter((sf) => sf.getFilePath().startsWith(prefix));
    }

    session(): EditSession {
        return new EditSession(this);
    }

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

const statKey = (s: Stats) => `${s.mtimeMs}:${s.size}:${s.ino}`;

const compilerOptionsFor = (root: ProjectRoot): ts.CompilerOptions => ({
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

const resolvePrettierConfig = async (): Promise<Options> => {
    try {
        // a hypothetical example-story file, so temp story roots format like the repo
        return (await resolveConfig(path.join(EXAMPLE_STORY_ROOT, 'data', 'source.ts'))) ?? {};
    } catch {
        return {};
    }
};

const loadPrettierOptions = async (): Promise<Options> => ({
    ...(await resolvePrettierConfig()),
    parser: 'typescript',
});

const tsPrettierOptions = (): Promise<Options> => {
    prettierOptions ??= loadPrettierOptions();
    return prettierOptions;
};

const formatTs = async (text: string): Promise<string> => format(text, await tsPrettierOptions());

type TAfterOp = (tx: TTransaction) => Promise<unknown>;

export class EditSession {
    private readonly original = new Map<string, string | null>();
    private readonly deletedDirs = new Set<string>();
    private readonly afterOps: TAfterOp[] = [];
    private done = false;

    constructor(readonly sp: SourceProject) {}

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

    // imports already unused before the session are the author's and stay
    pruneImports() {
        for (const [abs, names] of this.usedImports) {
            const sf = this.sp.file(abs);
            if (!sf) continue;
            for (const name of names) {
                if (importedNames(sf).has(name) && !isIdentifierUsed(sf, name)) removeImportOf(sf, name);
            }
        }
    }

    edit(abs: string, what?: string): SourceFile {
        const sf = this.sp.fileOrThrow(abs, what);
        this.track(abs);
        return sf;
    }

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

    deleteDir(dir: string) {
        for (const sf of this.sp.filesUnder(dir)) this.delete(sf.getFilePath());
        this.deletedDirs.add(dir);
    }

    after(op: TAfterOp) {
        this.afterOps.push(op);
    }

    rollback() {
        if (this.done) return;
        this.done = true;
        this.sp.applyState(this.original);
    }

    // the commit's type check, on the unformatted state, which is then undone
    check(): TDiagnosticDto[] {
        if (this.done) throw new Error('EditSession already finished');
        try {
            this.apply(() => this.pruneImports());
            return this.freshDiagnostics(new Map([...this.original.keys()].map((abs) => [abs, this.sp.text(abs)])));
        } finally {
            this.rollback();
        }
    }

    // a story already broken by a hand edit stays editable: only errors the change adds count
    private freshDiagnostics(next: Map<string, string | null>): TDiagnosticDto[] {
        const after = diagnoseProject(this.sp);
        if (after.length === 0) return [];
        this.sp.applyState(this.original);
        const baseline = diagnoseProject(this.sp);
        this.sp.applyState(next);
        return newDiagnostics(baseline, after);
    }

    apply<T>(fn: () => T): T {
        try {
            return fn();
        } catch (e) {
            this.rollback();
            if (isHttpError(e)) throw e;
            const message = e instanceof Error ? e.message : String(e);
            if (/syntax error was inserted|Manipulation error/i.test(message)) {
                throw HttpError.invalid([syntaxDiagnostic('', message.split('\n')[0])], 'A code field does not parse');
            }
            throw e;
        }
    }

    async commit(
        bus: EventBus,
        event: (texts: Map<string, string | null>) => TChangeEvent | null,
        {
            asReferences,
            fields,
        }: {
            // deletes: new type errors mean a dangling id literal, i.e. still referenced
            asReferences?: (diagnostics: TDiagnosticDto[]) => TReferenceDto[];
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
                        [syntaxDiagnostic(this.sp.root.rel(abs), e instanceof Error ? e.message : String(e))],
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

            const fresh = this.freshDiagnostics(next);
            if (fresh.length > 0) {
                if (asReferences) throw HttpError.referenced(asReferences(fresh));
                throw HttpError.invalid(fields ? withFields(this.sp, fresh, fields.file, fields.map) : fresh);
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
