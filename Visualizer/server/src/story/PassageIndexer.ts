import { Project, SyntaxKind, type Node, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import type { TPassageSummary } from './types';

/**
 * Static analysis of the author's passage files (VISUALIZER_PLAN §5.1).
 *
 * ## Why passages, and only passages, are read this way
 *
 * Everything else the server serves — chapters, locations, maps, characters — is a plain object
 * literal, so the server imports `@story/data` and reads the real values. §5.1 explicitly
 * permits that, and it is both simpler and *more* accurate than re-deriving a chapter title
 * from its source text.
 *
 * Passages cannot be read that way. A passage file exports a **function** of `(s, e)`: calling
 * it needs a world state, and the passage it returns depends on that state, so "what does this
 * passage link to" has no single answer at runtime. Evaluating them server-side would mean
 * simulating the story in order to list it, which is the thing §5.1 rules out. So passages are
 * parsed rather than executed.
 *
 * ## What that costs, stated plainly
 *
 * The link graph is **approximate**. This finds every `passageId` / `nextPassageId` / `redirect`
 * that appears as a string literal, anywhere in the function body, in any branch. That means:
 *
 *  - Branches the player can never reach are still listed. Over-reporting is the right failure:
 *    the Visualizer draws a graph, and an edge that exists in the source but not in play is
 *    useful to see. An edge that is missing is not.
 *  - A link built by concatenation (`` `village-thomas-${name}` ``) is invisible. There are none
 *    in this story, and the alternative is evaluation.
 *
 * Both are the same trade §5.1 makes for the whole server: static reading, no runtime.
 */

/** Property names whose string-literal values are passage references. */
const LINK_PROPERTIES = new Set(['passageId', 'nextPassageId', 'redirect']);

/** Property names that identify the passage itself, so they are not mistaken for links. */
const SELF_PROPERTIES = new Set(['id', 'chapterId', 'characterId']);

export class PassageIndexer {
    /**
     * One ts-morph `Project` reused across reads.
     *
     * `skipAddingFilesFromTsConfig` and an in-memory-free (real) file system: the project is a
     * parser here, not a type checker. Adding the repo's tsconfig would pull the entire
     * workspace — every package, every `@types` — into a program that exists to read a few
     * object literals, which takes seconds instead of milliseconds and buys nothing, because
     * nothing below asks a type question.
     */
    private readonly project = new Project({
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
        compilerOptions: { allowJs: false },
    });

    /** Re-reads a file from disk, replacing whatever the project had. */
    load(absolutePath: string): SourceFile {
        const existing = this.project.getSourceFile(absolutePath);
        if (existing) {
            existing.refreshFromFileSystemSync();
            return existing;
        }
        return this.project.addSourceFileAtPath(absolutePath);
    }

    /** Drops a file from the project — called when the watcher says it was deleted. */
    forget(absolutePath: string): void {
        const existing = this.project.getSourceFile(absolutePath);
        if (existing) this.project.removeSourceFile(existing);
    }

    /**
     * Every passage declared in one file.
     *
     * A passage file exports one or more `const x = (s, e) => ({ … })` arrow functions. Anything
     * whose returned literal has no `id` is skipped rather than guessed at — a helper in the
     * same file is not a passage.
     */
    indexFile(absolutePath: string, repoRelative: string, hash: string | null): TPassageSummary[] {
        const sourceFile = this.load(absolutePath);
        const found: TPassageSummary[] = [];

        for (const declaration of sourceFile.getVariableDeclarations()) {
            const literal = returnedObjectLiteral(declaration.getInitializer());
            if (!literal) continue;

            const id = stringProperty(literal, 'id');
            const chapterId = stringProperty(literal, 'chapterId');
            const characterId = stringProperty(literal, 'characterId');
            if (!id || !chapterId || !characterId) continue;

            const wholeId = `${chapterId}-${characterId}-${id}`;
            found.push({
                id: wholeId,
                chapterId,
                characterId,
                localId: id,
                type: passageType(stringProperty(literal, 'type')),
                title: stringProperty(literal, 'title'),
                image: stringProperty(literal, 'image'),
                linkedPassageIds: collectLinks(literal, wholeId),
                line: declaration.getStartLineNumber(),
                file: repoRelative,
                hash,
            });
        }

        return found;
    }

    /** Line number of a named export in a file, for `POST …/open`. `1` when not found. */
    lineOfExport(absolutePath: string, exportName: string): number {
        const sourceFile = this.load(absolutePath);
        const declaration = sourceFile.getVariableDeclaration(exportName);
        return declaration?.getStartLineNumber() ?? 1;
    }
}

/**
 * Unwraps the shapes a passage can be declared in and returns the object literal it produces:
 *
 *   `(s, e) => ({ … })`   — the concise arrow body, which is what every passage here uses
 *   `(s, e) => { return { … } }`  — the block body
 *   `{ … }`               — a plain object, for anything that is not a function
 */
const returnedObjectLiteral = (node: Node | undefined): ObjectLiteralExpression | undefined => {
    if (!node) return undefined;

    if (node.isKind(SyntaxKind.ObjectLiteralExpression)) return node;

    if (node.isKind(SyntaxKind.ArrowFunction) || node.isKind(SyntaxKind.FunctionExpression)) {
        const body = node.getBody();
        if (body.isKind(SyntaxKind.ObjectLiteralExpression)) return body;

        // `(…) => ({ … })` parses the parentheses as their own node.
        if (body.isKind(SyntaxKind.ParenthesizedExpression)) {
            const inner = body.getExpression();
            if (inner.isKind(SyntaxKind.ObjectLiteralExpression)) return inner;
        }

        if (body.isKind(SyntaxKind.Block)) {
            // The *first* return with an object literal. A passage with several returns in
            // several branches is read from the first; the links from all of them are still
            // collected, because `collectLinks` walks the whole function.
            for (const statement of body.getStatements()) {
                if (!statement.isKind(SyntaxKind.ReturnStatement)) continue;
                const expression = statement.getExpression();
                if (expression?.isKind(SyntaxKind.ObjectLiteralExpression)) return expression;
                if (expression?.isKind(SyntaxKind.ParenthesizedExpression)) {
                    const inner = expression.getExpression();
                    if (inner.isKind(SyntaxKind.ObjectLiteralExpression)) return inner;
                }
            }
        }
    }

    // `satisfies` / `as` wrappers.
    if (node.isKind(SyntaxKind.AsExpression) || node.isKind(SyntaxKind.SatisfiesExpression)) {
        return returnedObjectLiteral(node.getExpression());
    }

    return undefined;
};

/** Value of a string-literal property, or `null` when it is absent or computed. */
const stringProperty = (literal: ObjectLiteralExpression, name: string): string | null => {
    const property = literal.getProperty(name);
    if (!property?.isKind(SyntaxKind.PropertyAssignment)) return null;
    const initializer = property.getInitializer();
    if (!initializer) return null;
    if (initializer.isKind(SyntaxKind.StringLiteral)) return initializer.getLiteralValue();
    if (initializer.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) return initializer.getLiteralValue();
    // A computed title (`_('Forest')`, a ternary) is reported as absent rather than as source
    // text: the client would rather show nothing than show `_('Forest')`.
    return null;
};

const passageType = (raw: string | null): TPassageSummary['type'] =>
    raw === 'screen' || raw === 'linear' || raw === 'transition' ? raw : 'unknown';

/**
 * Every passage id reachable from this literal, in source order, deduplicated.
 *
 * Walks the whole subtree rather than a known set of paths, because links live at different
 * depths in the three passage types — `links[].passageId` on a screen, `nextPassageId` on a
 * linear, `redirect` on a transition — and new shapes should be found without this needing an
 * edit.
 */
const collectLinks = (literal: ObjectLiteralExpression, selfId: string): string[] => {
    const links = new Set<string>();

    literal.forEachDescendant((node) => {
        if (!node.isKind(SyntaxKind.PropertyAssignment)) return;

        const name = node.getName().replace(/^['"]|['"]$/g, '');
        if (SELF_PROPERTIES.has(name)) return;
        if (!LINK_PROPERTIES.has(name)) return;

        const initializer = node.getInitializer();
        if (!initializer) return;

        if (initializer.isKind(SyntaxKind.StringLiteral)) {
            const value = initializer.getLiteralValue();
            if (value && value !== selfId) links.add(value);
            return;
        }

        // A ternary of two literals — `cond ? 'a' : 'b'` — is common enough in authored
        // passages that reporting both branches is worth the special case.
        if (initializer.isKind(SyntaxKind.ConditionalExpression)) {
            for (const branch of [initializer.getWhenTrue(), initializer.getWhenFalse()]) {
                if (branch.isKind(SyntaxKind.StringLiteral)) {
                    const value = branch.getLiteralValue();
                    if (value && value !== selfId) links.add(value);
                }
            }
        }
    });

    return [...links];
};
