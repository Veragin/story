import path from 'node:path';
import {
    type ArrayLiteralExpression,
    type Expression,
    type ImportDeclaration,
    Node,
    type ObjectLiteralExpression,
    type PropertyAssignment,
    type SourceFile,
    SyntaxKind,
    type TypeAliasDeclaration,
    type VariableDeclaration,
} from 'ts-morph';

/**
 * Small, generic AST helpers the readers, writers and the registry share. Nothing here knows
 * the story's layout; see `layout.ts` for that.
 */

/** Strip `( … )`, `… as const`, `… satisfies T` and `<T>…` around an expression. */
export const unwrap = (expr: Expression): Expression => {
    let e: Expression = expr;
    for (;;) {
        if (Node.isParenthesizedExpression(e) || Node.isAsExpression(e) || Node.isSatisfiesExpression(e)) {
            e = e.getExpression();
        } else if (Node.isTypeAssertion(e)) {
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

/** The key of a property as a plain string (identifier, string or numeric literal), else undefined. */
export const propertyKey = (prop: Node): string | undefined => {
    if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) return undefined;
    const name = prop.getNameNode();
    if (Node.isIdentifier(name)) return name.getText();
    if (Node.isStringLiteral(name) || Node.isNoSubstitutionTemplateLiteral(name)) return name.getLiteralText();
    if (Node.isNumericLiteral(name)) return name.getText();
    return undefined;
};

/** `obj.key` as a property assignment (`key: value` or `'key': value`). */
export const getProp = (obj: ObjectLiteralExpression, key: string): PropertyAssignment | undefined => {
    for (const p of obj.getProperties()) {
        if (Node.isPropertyAssignment(p) && propertyKey(p) === key) return p;
    }
    return undefined;
};

export const getPropInit = (obj: ObjectLiteralExpression | undefined, key: string): Expression | undefined =>
    obj ? getProp(obj, key)?.getInitializer() : undefined;

/** Whether every member of the object literal is a plain `key: value` with a readable key. */
export const isPlainObject = (obj: ObjectLiteralExpression): boolean =>
    obj.getProperties().every((p) => Node.isPropertyAssignment(p) && propertyKey(p) !== undefined);

/** The literal text of a string literal / no-substitution template, else undefined. */
export const stringLiteral = (expr: Expression | undefined): string | undefined => {
    if (!expr) return undefined;
    const e = unwrap(expr);
    if (Node.isStringLiteral(e) || Node.isNoSubstitutionTemplateLiteral(e)) return e.getLiteralText();
    return undefined;
};

/** `obj.key` when it is a string literal. */
export const stringProp = (obj: ObjectLiteralExpression | undefined, key: string): string | undefined =>
    stringLiteral(getPropInit(obj, key));

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** A property key as source: bare when it is an identifier, quoted otherwise. */
export const keyText = (key: string) => (IDENTIFIER_RE.test(key) ? key : quote(key));

/** A single-quoted JS string literal (the repo's prettier style). */
export const quote = (s: string): string =>
    `'${JSON.stringify(s).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;

/** The 1-based line a node starts on (after leading trivia). */
export const lineOf = (node: Node) => node.getStartLineNumber();

// ---------------------------------------------------------------------------------------------
// Declarations

/** Every `const x = …` declared at the top level of a file, exported or not. */
export const topLevelVariables = (sf: SourceFile): VariableDeclaration[] =>
    sf.getVariableStatements().flatMap((s) => s.getDeclarations());

/** The exported const whose initializer is an object literal satisfying `test`. */
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

// ---------------------------------------------------------------------------------------------
// Imports

/** `from '…'` of `target`, as written from `fromFile` (`./x/y`, no extension). */
export const relativeModule = (fromFile: string, target: string): string => {
    let rel = path.relative(path.dirname(fromFile), target).split(path.sep).join('/');
    rel = rel.replace(/\.tsx?$/, '');
    return rel.startsWith('.') ? rel : `./${rel}`;
};

/** The import declaration that brings `localName` into the file. */
export const findImportOf = (sf: SourceFile, localName: string): ImportDeclaration | undefined =>
    sf
        .getImportDeclarations()
        .find(
            (d) =>
                d.getDefaultImport()?.getText() === localName ||
                d.getNamedImports().some((n) => (n.getAliasNode()?.getText() ?? n.getName()) === localName)
        );

/** Local names bound by any import of the file. */
export const importedNames = (sf: SourceFile): Set<string> => {
    const names = new Set<string>();
    for (const d of sf.getImportDeclarations()) {
        const def = d.getDefaultImport();
        if (def) names.add(def.getText());
        for (const n of d.getNamedImports()) names.add(n.getAliasNode()?.getText() ?? n.getName());
        const ns = d.getNamespaceImport();
        if (ns) names.add(ns.getText());
    }
    return names;
};

/**
 * Make `name` (optionally `as alias`) importable from `module` in `sf`. Reuses an existing
 * declaration of that module (a value import is added to a value declaration; a type-only
 * import may go into either). Returns the local name to use.
 */
export const ensureNamedImport = (
    sf: SourceFile,
    name: string,
    module: string,
    { typeOnly = false, alias }: { typeOnly?: boolean; alias?: string } = {}
): string => {
    const local = alias ?? name;
    const decls = sf.getImportDeclarations().filter((d) => d.getModuleSpecifierValue() === module);
    for (const d of decls) {
        const found = d
            .getNamedImports()
            .find((n) => n.getName() === name && (n.getAliasNode()?.getText() ?? n.getName()) === local);
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

/** Add `import def from 'module'` unless the file already has it. */
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

/**
 * Remove a top-level statement and keep the blank line that separated its group from the next
 * one (ts-morph's `remove()` swallows it when the statement is the last of a group, e.g. the last
 * import before the first declaration). Note: the fix-up forgets previously navigated nodes of
 * the file, so callers re-query afterwards.
 */
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

/** Remove the import binding `localName`; drops the whole declaration when it becomes empty. */
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
    const spec = decl.getNamedImports().find((n) => (n.getAliasNode()?.getText() ?? n.getName()) === localName);
    if (!spec) return;
    if (decl.getNamedImports().length === 1 && !decl.getDefaultImport() && !decl.getNamespaceImport()) {
        removeStatement(decl);
    } else {
        spec.remove();
    }
};

/** Remove every import declaration whose module resolves to a file for which `test` holds. */
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

/** Whether `name` is still used anywhere in the file outside import declarations. */
export const isIdentifierUsed = (sf: SourceFile, name: string): boolean =>
    sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some((id) => id.getText() === name && !id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration));

/**
 * The file an identifier used in `sf` comes from: the source file of its import (resolved by
 * module specifier, no type checker needed), or `sf` itself for a local declaration.
 */
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
    const spec = decl.getNamedImports().find((n) => (n.getAliasNode()?.getText() ?? n.getName()) === name);
    return spec ? { file: target, exportName: spec.getName() } : undefined;
};

// ---------------------------------------------------------------------------------------------
// Union types (`export type TX = 'a' | 'b'`)

/** The member texts of a type alias's union (a single member for a non-union). `never` → []. */
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

/** The string-literal members of a union alias. */
export const unionLiterals = (alias: TypeAliasDeclaration): string[] => {
    const node = alias.getTypeNode();
    if (!node) return [];
    const nodes = Node.isUnionTypeNode(node) ? node.getTypeNodes() : [node];
    const out: string[] = [];
    for (const t of nodes) {
        if (Node.isLiteralTypeNode(t)) {
            const lit = t.getLiteral();
            if (Node.isStringLiteral(lit)) out.push(lit.getLiteralText());
        }
    }
    return out;
};

/** Capitalise the first letter (`village` → `Village`). */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
