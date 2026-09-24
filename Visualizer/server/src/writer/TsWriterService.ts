import { Injectable } from '@nestjs/common';
import { Project, SyntaxKind, type ObjectLiteralExpression, type SourceFile, type VariableDeclaration } from 'ts-morph';
import { SourceFileService } from '../story/SourceFileService';
import { FormatterService } from './FormatterService';

/**
 * Property-level edits to the author's TypeScript (VISUALIZER_PLAN §4.5).
 *
 * ## The one rule this class exists to enforce
 *
 * §4.5 rule 2: *"The writer locates a named property of a named export and replaces its
 * initializer. It never re-prints a file, never reorders, never drops a comment, and never
 * touches a passage's function body. If the property is missing it is appended; if the export is
 * not an object literal (a passage is a **function**), the writer refuses with `422` and an
 * explanatory message rather than guessing."*
 *
 * That is §8 risk 2 — "ts-morph writing files the author also hand-edits" — and the scenario it
 * rules out is the one that loses work: a writer that re-prints a passage file and drops the
 * logic in it. Everything below is shaped by it:
 *
 *  - Edits go through `setInitializer` on one `PropertyAssignment`. ts-morph rewrites exactly
 *    that span of text; every other byte of the file — comments, blank lines, import order, the
 *    type alias at the bottom — is untouched by construction, not by care.
 *  - `WriterRefusal` is thrown, not worked around, whenever the shape is not the one expected.
 *    Refusing is always available and always safe; guessing is neither.
 *  - Nothing here deletes a file or rewrites a function body.
 *
 * ## Rule 3: no markers
 *
 * There are no `// GENERATED — DO NOT EDIT` fences anywhere in the output. The author is
 * expected to hand-edit these files; that is the whole point of the fork-per-story design.
 */

/** Thrown when the source is not a shape the writer is willing to edit. Becomes a `422`. */
export class WriterRefusal extends Error {
    constructor(
        message: string,
        readonly file: string
    ) {
        super(message);
        this.name = 'WriterRefusal';
    }
}

/** Thrown when the caller's `If-Match` does not match the file on disk. Becomes a `409`. */
export class WriteConflict extends Error {
    constructor(
        readonly file: string,
        readonly expected: string | null,
        readonly actual: string | null
    ) {
        super(`"${file}" changed on disk since it was read`);
        this.name = 'WriteConflict';
    }
}

/** One property to set on one export. */
export type TPropertyEdit = {
    /** The property name, e.g. `title` or `shape`. Nested paths are not supported — see below. */
    name: string;
    /**
     * The new initializer, as TypeScript source text. The caller builds this (usually with
     * `literal()`), because only the caller knows whether a value should be `'a'`, `Time.from(…)`
     * or a reference to an imported symbol.
     *
     * `undefined` removes the property.
     */
    initializer: string | undefined;
};

export type TWriteResult = {
    file: string;
    /** Content hash *after* the write — the next `If-Match` token. */
    hash: string;
    /** Properties that were actually changed. Empty when the edit was a no-op. */
    changed: string[];
};

@Injectable()
export class TsWriterService {
    /**
     * A fresh `Project` per write.
     *
     * Not a cached one, and that is deliberate: the author edits these files by hand between
     * requests (`POST …/open` exists to send them there), so a cached `SourceFile` is stale by
     * default. A parse is single-digit milliseconds for one file; a stale write is lost work.
     */
    private newProject(): Project {
        return new Project({
            skipAddingFilesFromTsConfig: true,
            skipFileDependencyResolution: true,
            compilerOptions: { allowJs: false },
        });
    }

    constructor(
        private readonly files: SourceFileService,
        private readonly formatter: FormatterService
    ) {}

    /**
     * Sets properties on the object literal a named export is initialised with.
     *
     * @param expectedHash `If-Match` from the caller. `undefined` skips the check — used by
     *        internal callers that just read the file. A *mismatch* is always a `WriteConflict`.
     */
    async setProperties(
        repoRelativeFile: string,
        exportName: string,
        edits: readonly TPropertyEdit[],
        expectedHash?: string | null
    ): Promise<TWriteResult> {
        const original = await this.files.readIfPresent(repoRelativeFile);
        if (original === null) {
            throw new WriterRefusal(`"${repoRelativeFile}" does not exist`, repoRelativeFile);
        }

        await this.assertUnchanged(repoRelativeFile, expectedHash);

        const project = this.newProject();
        const sourceFile = project.createSourceFile(repoRelativeFile, original, { overwrite: true });
        const literal = this.objectLiteralOf(sourceFile, exportName, repoRelativeFile);

        const changed: string[] = [];
        for (const edit of edits) {
            if (this.applyEdit(literal, edit, repoRelativeFile)) changed.push(edit.name);
        }

        if (changed.length === 0) {
            const hash = await this.files.hashOf(repoRelativeFile);
            return { file: repoRelativeFile, hash: hash ?? '', changed: [] };
        }

        const formatted = await this.formatter.format(sourceFile.getFullText(), repoRelativeFile);
        await this.files.write(repoRelativeFile, formatted);

        const hash = await this.files.hashOf(repoRelativeFile);
        return { file: repoRelativeFile, hash: hash ?? '', changed };
    }

    /** Creates a file from scratch. Refuses to overwrite one that already exists. */
    async createFile(repoRelativeFile: string, contents: string): Promise<TWriteResult> {
        if (await this.files.exists(repoRelativeFile)) {
            throw new WriterRefusal(`"${repoRelativeFile}" already exists`, repoRelativeFile);
        }

        const formatted = await this.formatter.format(contents, repoRelativeFile);
        await this.files.write(repoRelativeFile, formatted);

        const hash = await this.files.hashOf(repoRelativeFile);
        return { file: repoRelativeFile, hash: hash ?? '', changed: ['*'] };
    }

    /** Reads one property's initializer text. For round-tripping a value the client did not send. */
    async readProperty(repoRelativeFile: string, exportName: string, property: string): Promise<string | null> {
        const original = await this.files.readIfPresent(repoRelativeFile);
        if (original === null) return null;

        const project = this.newProject();
        const sourceFile = project.createSourceFile(repoRelativeFile, original, { overwrite: true });
        const literal = this.objectLiteralOf(sourceFile, exportName, repoRelativeFile);

        const assignment = literal.getProperty(property);
        if (!assignment?.isKind(SyntaxKind.PropertyAssignment)) return null;
        return assignment.getInitializer()?.getText() ?? null;
    }

    /**
     * Throws a `WriteConflict` unless the file's current hash matches `expected`.
     *
     * This is §5.3's optimistic concurrency, and without it the file watcher and a hand edit in
     * VS Code silently overwrite each other. `null`/`undefined` means the caller is not
     * participating, which is allowed — see the note on the `git status` backstop below.
     */
    async assertUnchanged(repoRelativeFile: string, expected: string | null | undefined): Promise<void> {
        if (expected === undefined || expected === null || expected === '') return;
        const actual = await this.files.hashOf(repoRelativeFile);
        if (actual !== expected) throw new WriteConflict(repoRelativeFile, expected, actual);
    }

    /* ----------------------------------------------------------------- shapes */

    /**
     * The object literal a named export is initialised with, or a refusal.
     *
     * Every refusal below names the actual shape it found, because "422" alone leaves the author
     * with no idea which of their files the Visualizer declined to edit or why.
     */
    private objectLiteralOf(sourceFile: SourceFile, exportName: string, file: string): ObjectLiteralExpression {
        const declaration: VariableDeclaration | undefined = sourceFile.getVariableDeclaration(exportName);
        if (!declaration) {
            throw new WriterRefusal(
                `"${file}" has no exported "${exportName}" — the Visualizer will not guess which declaration to edit`,
                file
            );
        }

        const initializer = declaration.getInitializer();
        if (!initializer) {
            throw new WriterRefusal(`"${exportName}" in "${file}" has no initializer`, file);
        }

        // §4.5 rule 2's named case: a passage is a *function*, and rewriting a function body is
        // exactly the thing that loses the author's logic.
        if (initializer.isKind(SyntaxKind.ArrowFunction) || initializer.isKind(SyntaxKind.FunctionExpression)) {
            throw new WriterRefusal(
                `"${exportName}" in "${file}" is a function, not an object literal. Passages are functions of (s, e) and the Visualizer will not rewrite one — edit it directly.`,
                file
            );
        }

        const unwrapped = unwrapAssertions(initializer);
        if (!unwrapped?.isKind(SyntaxKind.ObjectLiteralExpression)) {
            throw new WriterRefusal(
                `"${exportName}" in "${file}" is a ${initializer.getKindName()}, not an object literal`,
                file
            );
        }

        return unwrapped;
    }

    /**
     * Applies one property edit. Returns whether anything actually changed.
     *
     * A no-op edit is reported as such rather than written, so saving a form the author did not
     * modify does not produce a commit — and does not bump the hash out from under their next
     * `If-Match`.
     */
    private applyEdit(literal: ObjectLiteralExpression, edit: TPropertyEdit, file: string): boolean {
        const existing = literal.getProperty(edit.name);

        if (edit.initializer === undefined) {
            if (!existing) return false;
            if (!existing.isKind(SyntaxKind.PropertyAssignment)) {
                throw new WriterRefusal(
                    `"${edit.name}" in "${file}" is a ${existing.getKindName()}, not a plain property — refusing to remove it`,
                    file
                );
            }
            existing.remove();
            return true;
        }

        if (!existing) {
            // §4.5: "If the property is missing it is appended". Appended rather than inserted
            // in some guessed position, because any other placement is a judgement about the
            // author's file that the server is not entitled to make.
            literal.addPropertyAssignment({ name: edit.name, initializer: edit.initializer });
            return true;
        }

        // A shorthand (`{ title }`) or a spread is not a property whose initializer can be
        // replaced; a getter or method even less so.
        if (!existing.isKind(SyntaxKind.PropertyAssignment)) {
            throw new WriterRefusal(
                `"${edit.name}" in "${file}" is a ${existing.getKindName()}, not a plain property — the Visualizer will not rewrite it`,
                file
            );
        }

        // Compare normalised text so a reformat alone is not treated as a change: without this
        // every save rewrites the file and every open tab gets a spurious "changed on disk".
        const current = existing.getInitializer()?.getText() ?? '';
        if (normalise(current) === normalise(edit.initializer)) return false;

        existing.setInitializer(edit.initializer);
        return true;
    }
}

/** Unwraps `x as T` / `x satisfies T` so an asserted object literal is still editable. */
const unwrapAssertions = (node: ReturnType<VariableDeclaration['getInitializer']>) => {
    let current = node;
    for (let i = 0; i < 8 && current; i++) {
        if (current.isKind(SyntaxKind.AsExpression) || current.isKind(SyntaxKind.SatisfiesExpression)) {
            current = current.getExpression();
            continue;
        }
        if (current.isKind(SyntaxKind.ParenthesizedExpression)) {
            current = current.getExpression();
            continue;
        }
        return current;
    }
    return current;
};

/** Whitespace-insensitive comparison, for "did this property actually change?". */
const normalise = (text: string): string => text.replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ literals */

/**
 * Renders a JSON-ish value as TypeScript source.
 *
 * Deliberately *not* `JSON.stringify`: the output has to read like something the author would
 * have written, which means single quotes, unquoted keys where they are valid identifiers, and
 * no quotes around numbers. Prettier then decides the line breaks, so nothing here tries to.
 *
 * Only plain data is representable — a value that needs a constructor call (`Time.fromString`)
 * is built by the caller as raw source text and passed through `raw()`.
 */
export const literal = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    if (value instanceof RawSource) return value.text;

    switch (typeof value) {
        case 'string':
            return quote(value);
        case 'number':
            return Number.isFinite(value) ? String(value) : 'undefined';
        case 'boolean':
            return String(value);
        default:
            break;
    }

    if (Array.isArray(value)) {
        return `[${value.map(literal).join(', ')}]`;
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            // An explicit `undefined` in a payload means "not set", and writing
            // `rotation: undefined` into the author's file is noise.
            .filter(([, entryValue]) => entryValue !== undefined)
            .map(([key, entryValue]) => `${propertyKey(key)}: ${literal(entryValue)}`);
        return `{ ${entries.join(', ')} }`;
    }

    return 'undefined';
};

/** Wraps pre-rendered source so it passes through `literal` untouched. */
export class RawSource {
    constructor(readonly text: string) {}
}

export const raw = (text: string): RawSource => new RawSource(text);

/** Single quotes, matching `.prettierrc`'s `singleQuote`. Escapes what has to be escaped. */
const quote = (value: string): string => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * `.prettierrc` sets `quoteProps: 'consistent'`, which means *within one object* keys are either
 * all quoted or none are. So a key that needs quotes forces its siblings to be quoted too —
 * which Prettier does for us, as long as the ones that need quotes have them.
 */
const propertyKey = (key: string): string => (IDENTIFIER.test(key) ? key : quote(key));
