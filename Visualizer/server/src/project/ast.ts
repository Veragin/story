import path from 'node:path';
import {
    type ArrayLiteralExpression,
    type Expression,
    type ImportDeclaration,
    type ImportSpecifier,
    Node,
    type ObjectLiteralExpression,
    type PropertyAssignment,
    type SourceFile,
    SyntaxKind,
    type TypeAliasDeclaration,
    type VariableDeclaration,
    ts,
} from 'ts-morph';

export const unwrap = (expr: Expression): Expression => {
    let e: Expression = expr;
    for (;;) {
        if (
            Node.isParenthesizedExpression(e) ||
            Node.isAsExpression(e) ||
            Node.isSatisfiesExpression(e) ||
            Node.isTypeAssertion(e)
        ) {
            e = e.getExpression();
        } else {
            return e;
        }
    }
};

export const asObject = (expr: Expression | undefined): ObjectLiteralExpression | undefined => {
    if (!expr) return undefined;
    const e = unwrap(expr);
    return Node.isObjectLiteralExpression(e) ? e : undefined;
};

export const asArray = (expr: Expression | undefined): ArrayLiteralExpression | undefined => {
    if (!expr) return undefined;
    const e = unwrap(expr);
    return Node.isArrayLiteralExpression(e) ? e : undefined;
};

export const propertyKey = (prop: Node): string | undefined => {
    if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) return undefined;
    const name = prop.getNameNode();
    if (Node.isIdentifier(name)) return name.getText();
    if (Node.isStringLiteral(name) || Node.isNoSubstitutionTemplateLiteral(name)) return name.getLiteralText();
    if (Node.isNumericLiteral(name)) return name.getText();
    return undefined;
};

export const getProp = (obj: ObjectLiteralExpression, key: string): PropertyAssignment | undefined => {
    for (const p of obj.getProperties()) {
        if (Node.isPropertyAssignment(p) && propertyKey(p) === key) return p;
    }
    return undefined;
};

export const getPropInit = (obj: ObjectLiteralExpression | undefined, key: string): Expression | undefined =>
    obj ? getProp(obj, key)?.getInitializer() : undefined;

export const isPlainObject = (obj: ObjectLiteralExpression): boolean =>
    obj.getProperties().every((p) => Node.isPropertyAssignment(p) && propertyKey(p) !== undefined);

export const stringLiteral = (expr: Expression | undefined): string | undefined => {
    if (!expr) return undefined;
    const e = unwrap(expr);
    if (Node.isStringLiteral(e) || Node.isNoSubstitutionTemplateLiteral(e)) return e.getLiteralText();
    return undefined;
};

export const stringProp = (obj: ObjectLiteralExpression | undefined, key: string): string | undefined =>
    stringLiteral(getPropInit(obj, key));

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const keyText = (key: string) => (IDENTIFIER_RE.test(key) ? key : quote(key));

export const quote = (s: string): string =>
    `'${JSON.stringify(s).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;

export const lineOf = (node: Node) => node.getStartLineNumber();

export type TTextEdit = { start: number; end: number; text: string };

// raw trivia, since ts-morph's `PropertyAssignment` is not JSDocable
const triviaComments = (node: Node): ts.CommentRange[] => {
    const text = node.getSourceFile().getFullText();
    const pos = node.getPos();
    return [...(ts.getTrailingCommentRanges(text, pos) ?? []), ...(ts.getLeadingCommentRanges(text, pos) ?? [])];
};

const leadingJsDocRange = (node: Node): { pos: number; end: number } | undefined => {
    const comments = triviaComments(node);
    const last = comments[comments.length - 1];
    if (!last || last.kind !== SyntaxKind.MultiLineCommentTrivia) return undefined;
    const text = node.getSourceFile().getFullText();
    const comment = text.slice(last.pos, last.end);
    if (!comment.startsWith('/**') || comment === '/**/') return undefined;
    if (text.slice(last.end, node.getStart()).trim() !== '') return undefined;
    return { pos: last.pos, end: last.end };
};

export const parseJsDoc = (comment: string): string => {
    const lines = comment
        .slice(3, -2)
        .split(/\r?\n/)
        .map((line, i) => (i === 0 ? line : line.replace(/^\s*\*(?: |(?=\S)|$)?|^\s+/, '')).trimEnd());
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length > 0) lines[0] = lines[0].trimStart();
    return lines.join('\n').replace(/\*\\\//g, '*/');
};

export const readJsDoc = (node: Node): string | undefined => {
    const range = leadingJsDocRange(node);
    if (!range) return undefined;
    const description = parseJsDoc(node.getSourceFile().getFullText().slice(range.pos, range.end));
    return description === '' ? undefined : description;
};

export const formatJsDoc = (description: string, indent = ''): string => {
    const lines = description.replace(/\*\//g, '*\\/').split(/\r?\n/);
    if (lines.length === 1) return `/** ${lines[0]} */`;
    return ['/**', ...lines.map((l) => (l === '' ? ' *' : ` * ${l}`)), ' */'].join(`\n${indent}`);
};

const lineIndent = (node: Node): string | undefined => {
    const text = node.getSourceFile().getFullText();
    const start = node.getStart();
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const before = text.slice(lineStart, start);
    return before.trim() === '' ? before : undefined;
};

export const jsDocEdit = (node: Node, description: string | undefined): TTextEdit | undefined => {
    const want = description === '' ? undefined : description;
    if (readJsDoc(node) === want) return undefined;
    const range = leadingJsDocRange(node);
    const start = node.getStart();
    const indent = lineIndent(node);
    if (want === undefined) {
        // up to the node, so it inherits the comment's indentation
        return range ? { start: range.pos, end: start, text: '' } : undefined;
    }
    const comment = formatJsDoc(want, indent ?? '');
    if (range) return { start: range.pos, end: range.end, text: comment };
    return { start, end: start, text: indent === undefined ? `${comment} ` : `${comment}\n${indent}` };
};

export const propertyRemovalEdit = (prop: Node): TTextEdit => {
    const text = prop.getSourceFile().getFullText();
    let start = leadingJsDocRange(prop)?.pos ?? prop.getStart();
    let end = prop.getEnd();
    const comma = /^\s*,[ \t]*/.exec(text.slice(end));
    if (comma) end += comma[0].length;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const rest = /^[ \t]*(\r?\n|$)/.exec(text.slice(end));
    if (text.slice(lineStart, start).trim() === '' && rest) {
        start = lineStart;
        end += rest[0].length;
    }
    return { start, end, text: '' };
};

// back to front so earlier offsets stay valid; forgets every navigated node of `sf`
export const applyTextEdits = (sf: SourceFile, edits: TTextEdit[]) => {
    const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].end > sorted[i - 1].start) throw new Error('applyTextEdits: overlapping edits');
    }
    for (const e of sorted) {
        if (e.start === e.end) {
            if (e.text !== '') sf.insertText(e.start, e.text);
        } else if (e.text === '') sf.removeText(e.start, e.end);
        else sf.replaceText([e.start, e.end], e.text);
    }
};

export const topLevelVariables = (sf: SourceFile): VariableDeclaration[] =>
    sf.getVariableStatements().flatMap((s) => s.getDeclarations());

export const findExportedObject = (
    sf: SourceFile,
    test: (obj: ObjectLiteralExpression, decl: VariableDeclaration) => boolean = () => true
): { decl: VariableDeclaration; obj: ObjectLiteralExpression } | undefined => {
    for (const decl of topLevelVariables(sf)) {
        if (!decl.isExported()) continue;
        const obj = asObject(decl.getInitializer());
        if (obj && test(obj, decl)) return { decl, obj };
    }
    return undefined;
};

export const findTypeAlias = (sf: SourceFile, test: (name: string) => boolean): TypeAliasDeclaration | undefined =>
    sf.getTypeAliases().find((t) => test(t.getName()));

const importLocalName = (spec: ImportSpecifier) => spec.getAliasNode()?.getText() ?? spec.getName();

export const relativeModule = (fromFile: string, target: string): string => {
    let rel = path.relative(path.dirname(fromFile), target).split(path.sep).join('/');
    rel = rel.replace(/\.tsx?$/, '');
    return rel.startsWith('.') ? rel : `./${rel}`;
};

export const findImportOf = (sf: SourceFile, localName: string): ImportDeclaration | undefined =>
    sf
        .getImportDeclarations()
        .find(
            (d) =>
                d.getDefaultImport()?.getText() === localName ||
                d.getNamedImports().some((n) => importLocalName(n) === localName)
        );

export const importedNames = (sf: SourceFile): Set<string> => {
    const names = new Set<string>();
    for (const d of sf.getImportDeclarations()) {
        const def = d.getDefaultImport();
        if (def) names.add(def.getText());
        for (const n of d.getNamedImports()) names.add(importLocalName(n));
        const ns = d.getNamespaceImport();
        if (ns) names.add(ns.getText());
    }
    return names;
};

export const ensureNamedImport = (
    sf: SourceFile,
    name: string,
    module: string,
    { typeOnly = false, alias }: { typeOnly?: boolean; alias?: string } = {}
): string => {
    const local = alias ?? name;
    const decls = sf.getImportDeclarations().filter((d) => d.getModuleSpecifierValue() === module);
    for (const d of decls) {
        const found = d.getNamedImports().find((n) => n.getName() === name && importLocalName(n) === local);
        if (found) return local;
    }
    const target = decls.find((d) => !d.getNamespaceImport() && (typeOnly || !d.isTypeOnly()));
    if (target) {
        target.addNamedImport(alias ? { name, alias } : { name });
        return local;
    }
    const imports = sf.getImportDeclarations();
    const structure = {
        moduleSpecifier: module,
        namedImports: [alias ? { name, alias } : { name }],
        isTypeOnly: typeOnly,
    };
    if (imports.length > 0) {
        sf.insertImportDeclaration(imports[imports.length - 1].getChildIndex() + 1, structure);
    } else {
        sf.insertImportDeclaration(0, structure);
    }
    return local;
};

export const ensureDefaultImport = (sf: SourceFile, local: string, module: string): string => {
    const existing = sf
        .getImportDeclarations()
        .find((d) => d.getModuleSpecifierValue() === module && d.getDefaultImport()?.getText() === local);
    if (existing) return local;
    const imports = sf.getImportDeclarations();
    sf.insertImportDeclaration(imports.length > 0 ? imports[imports.length - 1].getChildIndex() + 1 : 0, {
        moduleSpecifier: module,
        defaultImport: local,
    });
    return local;
};

// ts-morph's `remove()` swallows the blank line after a group's last statement; restore it
export const removeStatement = (stmt: Node & { remove(): void }) => {
    const sf = stmt.getSourceFile();
    const text = sf.getFullText();
    const prev = stmt.getPreviousSibling();
    const next = stmt.getNextSibling();
    const blankAfter = !!next && /\n[ \t]*\r?\n/.test(text.slice(stmt.getEnd(), next.getStart()));
    const prevEnd = prev?.getEnd();
    const hadNext = !!next;
    stmt.remove();
    if (!blankAfter || prevEnd === undefined || !hadNext) return;
    const after = sf.getFullText();
    const rest = after.slice(prevEnd);
    const gap = /^\s*/.exec(rest)?.[0] ?? '';
    if (!/\n[ \t]*\r?\n/.test(gap)) sf.insertText(prevEnd, '\n');
};

export const removeImportOf = (sf: SourceFile, localName: string) => {
    const decl = findImportOf(sf, localName);
    if (!decl) return;
    if (decl.getDefaultImport()?.getText() === localName) {
        if (decl.getNamedImports().length === 0 && !decl.getNamespaceImport()) {
            removeStatement(decl);
            return;
        }
        decl.removeDefaultImport();
        return;
    }
    const spec = decl.getNamedImports().find((n) => importLocalName(n) === localName);
    if (!spec) return;
    if (decl.getNamedImports().length === 1 && !decl.getDefaultImport() && !decl.getNamespaceImport()) {
        removeStatement(decl);
    } else {
        spec.remove();
    }
};

export const removeImportsResolvingTo = (sf: SourceFile, test: (absFile: string) => boolean) => {
    const dir = path.dirname(sf.getFilePath());
    const matches = (d: ImportDeclaration) => {
        const spec = d.getModuleSpecifierValue();
        if (!spec.startsWith('.')) return false;
        const abs = path.resolve(dir, spec);
        return test(abs) || test(`${abs}.ts`);
    };
    for (let d = sf.getImportDeclarations().find(matches); d; d = sf.getImportDeclarations().find(matches)) {
        removeStatement(d);
    }
};

export const isIdentifierUsed = (sf: SourceFile, name: string): boolean =>
    sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some((id) => id.getText() === name && !id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration));

export const resolveIdentifierFile = (
    sf: SourceFile,
    name: string
): { file: SourceFile; exportName: string } | undefined => {
    const decl = findImportOf(sf, name);
    if (!decl) {
        return sf.getVariableDeclaration(name) ? { file: sf, exportName: name } : undefined;
    }
    const target = decl.getModuleSpecifierSourceFile();
    if (!target) return undefined;
    if (decl.getDefaultImport()?.getText() === name) return { file: target, exportName: 'default' };
    const spec = decl.getNamedImports().find((n) => importLocalName(n) === name);
    return spec ? { file: target, exportName: spec.getName() } : undefined;
};

export const unionMembers = (alias: TypeAliasDeclaration): string[] => {
    const node = alias.getTypeNode();
    if (!node) return [];
    if (Node.isUnionTypeNode(node)) return node.getTypeNodes().map((t) => t.getText());
    const text = node.getText();
    return text === 'never' ? [] : [text];
};

export const setUnionMembers = (alias: TypeAliasDeclaration, members: string[]) => {
    alias.setType(members.length === 0 ? 'never' : members.join(' | '));
};
