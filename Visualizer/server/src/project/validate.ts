import type { TDiagnosticDto } from '@story/visualizer-protocol';
import { type Diagnostic, Node, type SourceFile, ts } from 'ts-morph';
import { HttpError } from '../http/HttpError';
import type { SourceProject } from './SourceProject';

/**
 * In-memory validation before anything is written (plan WP2 "Rules", `validate.ts`).
 *
 * `diagnoseProject` type-checks every story file (`data/` + `types/`) of the long-lived ts-morph
 * program. That is cheap after the first run (the program is reused and only the edited files are
 * re-parsed), and it has to be the whole story: a change to `register.ts` or `TWorldState.ts`
 * re-types every file through `@story/types`. A commit is refused only for diagnostics that are
 * *new* compared with the files on disk, so a story that is already broken by a hand edit can
 * still be edited elsewhere.
 */
export const diagnoseProject = (sp: SourceProject): TDiagnosticDto[] => {
    const out: TDiagnosticDto[] = [];
    for (const sf of sp.storyFiles()) {
        for (const d of sf.getPreEmitDiagnostics()) {
            if (d.getCategory() !== ts.DiagnosticCategory.Error) continue;
            out.push(toDto(sp, d));
        }
    }
    return out;
};

const toDto = (sp: SourceProject, d: Diagnostic): TDiagnosticDto => {
    const sf = d.getSourceFile();
    const start = d.getStart() ?? 0;
    const pos = sf ? sf.getLineAndColumnAtPos(start) : { line: 1, column: 1 };
    return {
        file: sf ? sp.root.rel(sf.getFilePath()) : '',
        line: pos.line,
        column: pos.column,
        message: ts.flattenDiagnosticMessageText(d.compilerObject.messageText, '\n'),
        code: d.getCode(),
    };
};

/**
 * The dotted DTO path of the source position `pos` (`body.0.links.1.cost`, `init.health`): the
 * property names and array indexes of the object / array literals around it, up to the
 * resource's top-level object (a variable initializer or a `return`ed object).
 */
export const fieldPathAt = (sf: SourceFile, pos: number): string | undefined => {
    let node: Node | undefined = sf.getDescendantAtPos(pos);
    const segments: string[] = [];
    while (node) {
        const parent: Node | undefined = node.getParent();
        if (!parent) break;
        if (Node.isPropertyAssignment(parent) || Node.isShorthandPropertyAssignment(parent)) {
            segments.unshift(parent.getName().replace(/^['"]|['"]$/g, ''));
        } else if (Node.isArrayLiteralExpression(parent)) {
            const index = parent.getElements().findIndex((e) => e === node);
            if (index >= 0) segments.unshift(String(index));
        } else if (
            Node.isVariableDeclaration(parent) ||
            Node.isReturnStatement(parent) ||
            Node.isArrowFunction(parent) ||
            Node.isStatement(parent)
        ) {
            break;
        }
        node = parent;
    }
    return segments.length > 0 ? segments.join('.') : undefined;
};

/** Fill in `field` for the diagnostics that sit in `file`, through `map` (return undefined to drop it). */
export const withFields = (
    sp: SourceProject,
    diagnostics: TDiagnosticDto[],
    file: string,
    map: (path: string) => string | undefined = (p) => p
): TDiagnosticDto[] => {
    const sf = sp.file(file);
    const rel = sp.root.rel(file);
    if (!sf) return diagnostics;
    return diagnostics.map((d) => {
        if (d.file !== rel || d.field) return d;
        const pos = sf.compilerNode.getPositionOfLineAndCharacter(d.line - 1, d.column - 1);
        const path = fieldPathAt(sf, pos);
        const field = path === undefined ? undefined : map(path);
        return field ? { ...d, field } : d;
    });
};

const keyOf = (d: TDiagnosticDto) => `${d.file}|${d.code ?? ''}|${d.message}`;

/** Diagnostics in `after` that `before` does not have (compared as a multiset, ignoring positions). */
export const newDiagnostics = (before: TDiagnosticDto[], after: TDiagnosticDto[]): TDiagnosticDto[] => {
    const counts = new Map<string, number>();
    for (const d of before) counts.set(keyOf(d), (counts.get(keyOf(d)) ?? 0) + 1);
    const fresh: TDiagnosticDto[] = [];
    for (const d of after) {
        const n = counts.get(keyOf(d)) ?? 0;
        if (n > 0) counts.set(keyOf(d), n - 1);
        else fresh.push(d);
    }
    return fresh;
};

export const syntaxDiagnostic = (file: string, message: string, field?: string): TDiagnosticDto => ({
    file,
    line: 1,
    column: 1,
    message,
    ...(field ? { field } : {}),
});

type TParsed = ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] };

const parse = (text: string): TParsed =>
    ts.createSourceFile('snippet.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS) as TParsed;

/**
 * A `{ code }` field must be exactly one expression: `1 +` (does not parse) or `1, x: 2` (would
 * smuggle a sibling property into an object literal) are refused with a 422 naming the field.
 */
export const assertExpression = (code: string, field: string, file = '') => {
    const prefix = 'const __snippet = (\n';
    const sf = parse(`${prefix}${code}\n);`);
    const errors = sf.parseDiagnostics ?? [];
    let ok = errors.length === 0 && sf.statements.length === 1 && code.trim() !== '';
    if (ok) {
        const stmt = sf.statements[0];
        const init = ts.isVariableStatement(stmt) ? stmt.declarationList.declarations[0]?.initializer : undefined;
        ok =
            !!init &&
            ts.isParenthesizedExpression(init) &&
            !ts.isCommaListExpression(init.expression) &&
            !(
                ts.isBinaryExpression(init.expression) &&
                init.expression.operatorToken.kind === ts.SyntaxKind.CommaToken
            );
    }
    if (!ok) {
        const first = errors[0];
        const message = first
            ? ts.flattenDiagnosticMessageText(first.messageText, '\n')
            : 'Expected exactly one expression';
        throw HttpError.invalid([syntaxDiagnostic(file, message, field)], `Field "${field}" is not a valid expression`);
    }
};

/** A type's right-hand side (`dataType.code`) must parse as exactly one type. */
export const assertType = (code: string, field: string, file = '') => {
    const sf = parse(`type __Snippet = ${code};`);
    const errors = sf.parseDiagnostics ?? [];
    if (errors.length > 0 || sf.statements.length !== 1 || code.trim() === '') {
        const message = errors[0] ? ts.flattenDiagnosticMessageText(errors[0].messageText, '\n') : 'Expected one type';
        throw HttpError.invalid([syntaxDiagnostic(file, message, field)], `Field "${field}" is not a valid type`);
    }
};
