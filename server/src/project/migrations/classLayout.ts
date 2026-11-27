import path from 'node:path';
import { type ImportDeclaration, Node, type SourceFile, ts, type TypeAliasDeclaration } from 'ts-morph';
import type { EventBus } from '../../events/EventBus';
import { applyTextEdits, type TTextEdit } from '../ast';
import { TYPES_INDEX_FILE } from '../readers/structure';
import type { EditSession, SourceProject } from '../SourceProject';
import { commitMigration, notMigratedMessage } from './migrationSession';

export type TClassLayoutStep = 'Character' | 'Npc' | 'Location';

type TBuiltInClass = { from: string; to: TClassLayoutStep };

const BUILT_IN_CLASSES: readonly TBuiltInClass[] = [
    { from: 'TCharacter', to: 'Character' },
    { from: 'TNpc', to: 'Npc' },
    { from: 'TLocation', to: 'Location' },
];

const log = (message: string) => console.warn(`[server] class layout migration: ${message}`);

const typeFile = (name: string) => `types/${name}.ts`;

const plainObjectAlias = (sp: SourceProject, { from, to }: TBuiltInClass): TypeAliasDeclaration | undefined => {
    const alias = sp.file(sp.root.abs(typeFile(from)))?.getTypeAlias(from);
    if (!alias) return undefined;
    if (sp.file(sp.root.abs(typeFile(to)))) {
        log(`${typeFile(from)} declares ${from}, but ${typeFile(to)} exists already; left alone`);
        return undefined;
    }
    const node = alias.getTypeNode();
    if (!alias.isExported() || !Node.isTypeLiteral(node) || !node.getMembers().every(Node.isPropertySignature)) {
        log(`${typeFile(from)}: ${from} is not an exported object type of plain properties; left alone`);
        return undefined;
    }
    return alias;
};

const pushEdit = (edits: Map<string, TTextEdit[]>, abs: string, edit: TTextEdit) => {
    const list = edits.get(abs) ?? [];
    if (!list.some((e) => e.start === edit.start)) list.push(edit);
    edits.set(abs, list);
};

const renameEdits = (sp: SourceProject, aliases: Map<TBuiltInClass, TypeAliasDeclaration>) => {
    const edits = new Map<string, TTextEdit[]>();
    for (const [{ from, to }, alias] of aliases) {
        const nameNode = alias.getNameNode();
        for (const node of [nameNode, ...nameNode.findReferencesAsNodes()]) {
            const abs = node.getSourceFile().getFilePath();
            if (!sp.isStoryFile(abs) || node.getText() !== from) continue;
            pushEdit(edits, abs, { start: node.getStart(), end: node.getEnd(), text: to });
        }
    }
    return edits;
};

const resolvesTo = (sf: SourceFile, specifier: string, abs: string) => {
    if (!specifier.startsWith('.')) return false;
    const target = path.resolve(path.dirname(sf.getFilePath()), specifier);
    return `${target}.ts` === abs || target === abs;
};

const moduleSpecifierEdits = (sp: SourceProject, moved: TBuiltInClass[], edits: Map<string, TTextEdit[]>) => {
    for (const sf of sp.storyFiles()) {
        for (const decl of [...sf.getImportDeclarations(), ...sf.getExportDeclarations()]) {
            const literal = decl.getModuleSpecifier();
            const specifier = decl.getModuleSpecifierValue();
            if (!literal || specifier === undefined) continue;
            const hit = moved.find(({ from }) => resolvesTo(sf, specifier, sp.root.abs(typeFile(from))));
            if (!hit) continue;
            const renamed = `${specifier.slice(0, specifier.lastIndexOf('/') + 1)}${hit.to}`;
            const quote = literal.getText()[0];
            pushEdit(edits, sf.getFilePath(), {
                start: literal.getStart(),
                end: literal.getEnd(),
                text: `${quote}${renamed}${quote}`,
            });
        }
    }
};

const toClassEdits = (alias: TypeAliasDeclaration, name: string): TTextEdit[] => {
    const literal = alias.getTypeNodeOrThrow();
    const params = alias.getTypeParameters().map((p) => p.getText());
    const header = `export class ${name}${params.length > 0 ? `<${params.join(', ')}>` : ''} `;
    const members = Node.isTypeLiteral(literal) ? literal.getMembers() : [];
    return [
        { start: alias.getStart(), end: literal.getStart(), text: header },
        ...members.map((m) => ({ start: m.getStart(), end: m.getStart(), text: 'declare ' })),
        { start: literal.getEnd(), end: alias.getEnd(), text: '' },
    ];
};

const moveToClassFile = (sp: SourceProject, s: EditSession, { from, to }: TBuiltInClass) => {
    const oldAbs = sp.root.abs(typeFile(from));
    const sf = s.edit(oldAbs);
    applyTextEdits(sf, toClassEdits(sf.getTypeAliasOrThrow(to), to));
    const text = sf.getFullText();
    s.delete(oldAbs);
    s.create(sp.root.abs(typeFile(to)), text);
};

const isTypeOnlySymbol = (node: Node) => {
    const symbol = node.getSymbol();
    const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
    return target !== undefined && (target.getFlags() & ts.SymbolFlags.Value) === 0;
};

// a class import is type-only, so `types ⇄ data` stays a type-only cycle
const importClassesAsTypes = (decl: ImportDeclaration, classes: ReadonlySet<string>) => {
    if (decl.isTypeOnly()) return;
    const named = decl.getNamedImports();
    const isClass = (spec: (typeof named)[number]) => classes.has(spec.getName());
    if (!named.some(isClass)) return;
    const allTypes =
        !decl.getDefaultImport() &&
        !decl.getNamespaceImport() &&
        named.every((spec) => isClass(spec) || spec.isTypeOnly() || isTypeOnlySymbol(spec.getNameNode()));
    if (!allTypes) {
        for (const spec of named) if (isClass(spec)) spec.setIsTypeOnly(true);
        return;
    }
    for (const spec of named) if (spec.isTypeOnly()) spec.setIsTypeOnly(false);
    decl.setIsTypeOnly(true);
};

const renameBarrelComments = (sp: SourceProject, s: EditSession, moved: TBuiltInClass[]) => {
    const abs = sp.root.abs(TYPES_INDEX_FILE);
    if (!sp.file(abs)) return;
    const index = s.edit(abs);
    const text = moved.reduce(
        (acc, { from, to }) => acc.replace(new RegExp(`\\b${from}\\b`, 'g'), to),
        index.getFullText()
    );
    if (text !== index.getFullText()) index.replaceWithText(text);
};

const migrate = (sp: SourceProject, s: EditSession): TClassLayoutStep[] => {
    const aliases = new Map<TBuiltInClass, TypeAliasDeclaration>();
    for (const builtIn of BUILT_IN_CLASSES) {
        const alias = plainObjectAlias(sp, builtIn);
        if (alias) aliases.set(builtIn, alias);
    }
    const moved = [...aliases.keys()];
    if (moved.length === 0) return [];

    const edits = renameEdits(sp, aliases);
    moduleSpecifierEdits(sp, moved, edits);
    for (const [abs, list] of edits) applyTextEdits(s.edit(abs), list);
    for (const builtIn of moved) moveToClassFile(sp, s, builtIn);

    const classes = new Set<string>(moved.map((c) => c.to));
    for (const sf of sp.storyFiles()) {
        if (!s.touched(sf.getFilePath())) continue;
        for (const decl of sf.getImportDeclarations()) importClassesAsTypes(decl, classes);
    }
    renameBarrelComments(sp, s, moved);
    return moved.map((c) => c.to);
};

/**
 * Turns the built-in entity types `TCharacter` / `TNpc` / `TLocation` into the classes `Character` /
 * `Npc` / `Location`, each in its own `types/<Name>.ts`, and renames every reference in the story.
 * Idempotent; a result that does not type-check is logged and not written.
 */
export const migrateClassLayout = async (sp: SourceProject, bus: EventBus): Promise<TClassLayoutStep[]> => {
    const s = sp.session();
    try {
        const steps = s.apply(() => migrate(sp, s));
        if (steps.length === 0) {
            s.rollback();
            return [];
        }
        await commitMigration(sp, s, bus);
        return steps;
    } catch (e) {
        s.rollback();
        log(notMigratedMessage(sp, e));
        return [];
    }
};
