import { eventIds } from '@story/visualizer-protocol';
import { Node, type SourceFile, type VariableDeclaration } from 'ts-morph';
import type { EventBus } from '../../events/EventBus';
import { isHttpError } from '../../http/HttpError';
import {
    ensureNamedImport,
    importedNames,
    isIdentifierUsed,
    relativeModule,
    removeImportOf,
    removeStatement,
} from '../ast';
import { itemContainers } from '../readers/entities';
import { ITEM_INFO_FILE, LITERALS_FILE, readStructure } from '../readers/structure';
import type { EditSession, SourceProject } from '../SourceProject';

export type TStructureLayoutStep = 'literals' | 'npcFile' | 'itemInfo';

const TYPES_INDEX = 'types/index.ts';
const CHARACTER_FILE = 'types/TCharacter.ts';
const NPC_FILE = 'types/TNpc.ts';
const ITEM_FILE = 'types/TItem.ts';
const DATA_INDEX = 'data/index.ts';
const NPC_TYPES = ['TNpc', 'TNpcData'];
const ITEM_INFO_SATISFIES = 'Record<string, TItemInfo & Record<string, unknown>>';

const log = (message: string) => console.warn(`[visualizer-server] structure layout migration: ${message}`);

const replaceText = (sf: SourceFile, from: string, to: string) => {
    const text = sf.getFullText();
    if (text.includes(from)) sf.replaceWithText(text.replace(from, to));
};

// the barrel comments of the template, which list what each module exports
const replaceInFile = (sp: SourceProject, s: EditSession, file: string, from: string, to: string) => {
    const abs = sp.root.abs(file);
    if (sp.file(abs)) replaceText(s.edit(abs), from, to);
};

const addBarrelExport = (
    sp: SourceProject,
    s: EditSession,
    { module, after, comment }: { module: string; after: string; comment: string }
) => {
    const abs = sp.root.abs(TYPES_INDEX);
    if (!sp.file(abs)) return;
    const index = s.edit(abs);
    const exports = index.getExportDeclarations();
    if (exports.some((d) => d.getModuleSpecifierValue() === module)) return;
    const text = `${comment}\nexport * from '${module}';`;
    const anchor = exports.find((d) => d.getModuleSpecifierValue() === after);
    if (anchor) index.insertText(anchor.getEnd(), `\n${text}`);
    else index.insertText(index.getEnd(), `\n${text}\n`);
};

// one at a time: a removal can forget the file's other nodes
const removeAlias = (sf: SourceFile, name: string) => {
    const alias = sf.getTypeAlias(name);
    if (alias) removeStatement(alias);
};

const pruneUnusedImports = (sf: SourceFile) => {
    for (const name of importedNames(sf)) if (!isIdentifierUsed(sf, name)) removeImportOf(sf, name);
};

const addLiteralsFile = (sp: SourceProject, s: EditSession): boolean => {
    const abs = sp.root.abs(LITERALS_FILE);
    if (sp.file(abs)) return false;
    s.create(abs, 'export {};\n');
    addBarrelExport(sp, s, { module: './literals', after: './ids', comment: '/* literals shared across files */' });
    return true;
};

// `TInitInventory` was local to `TCharacter.ts`; `TNpc.ts` needs it too
const exportInitInventory = (sp: SourceProject, s: EditSession, characterFile: SourceFile) => {
    const local = characterFile.getTypeAlias('TInitInventory');
    if (!local || local.isExported()) return;
    const itemFile = s.edit(sp.root.abs(ITEM_FILE), ITEM_FILE);
    const typeText = local.getTypeNodeOrThrow().getText();
    removeStatement(local);
    if (!itemFile.getTypeAlias('TInitInventory')) {
        itemFile.insertText(itemFile.getEnd(), `\nexport type TInitInventory = ${typeText};\n`);
    }
    replaceInFile(
        sp,
        s,
        TYPES_INDEX,
        '/* TItemId, TItem, TItemPartial */',
        '/* TItemId, TItem, TItemPartial, TInitInventory */'
    );
    ensureNamedImport(characterFile, 'TInitInventory', './TItem');
};

const moveNpcTypes = (sp: SourceProject, s: EditSession): boolean => {
    const characterAbs = sp.root.abs(CHARACTER_FILE);
    const npcAbs = sp.root.abs(NPC_FILE);
    const declares = sp
        .file(characterAbs)
        ?.getTypeAliases()
        .some((a) => NPC_TYPES.includes(a.getName()));
    if (!declares) return false;
    if (sp.file(npcAbs)) {
        log(`${CHARACTER_FILE} declares TNpc / TNpcData, but ${NPC_FILE} exists already; left alone`);
        return false;
    }
    const characterFile = s.edit(characterAbs);
    exportInitInventory(sp, s, characterFile);
    const aliases = characterFile.getTypeAliases().filter((a) => NPC_TYPES.includes(a.getName()));
    const imports = characterFile.getImportDeclarations().map((d) => d.getText());
    const body = aliases.map((a) => a.getText(true));
    for (const name of NPC_TYPES) removeAlias(characterFile, name);
    pruneUnusedImports(s.create(npcAbs, `${imports.join('\n')}\n\n${body.join('\n\n')}\n`));
    addBarrelExport(sp, s, { module: './TNpc', after: './TCharacter', comment: '/* TNpc, TNpcData */' });
    replaceInFile(
        sp,
        s,
        TYPES_INDEX,
        '/* TCharacter, TCharacterData, TNpc, TNpcData */',
        '/* TCharacter, TCharacterData */'
    );
    return true;
};

const isConstObject = (decl: VariableDeclaration | undefined): decl is VariableDeclaration => {
    const init = decl?.getInitializer();
    return (
        Node.isAsExpression(init) &&
        init.getTypeNode()?.getText() === 'const' &&
        Node.isObjectLiteralExpression(init.getExpression())
    );
};

const findItemCheck = (sf: SourceFile, exportName: string) =>
    sf
        .getStatements()
        .find(
            (statement) =>
                Node.isExpressionStatement(statement) &&
                statement.getText().replace(/\s+/g, '').startsWith(`Object.values(${exportName}).forEach(`)
        );

// `as const` stays, so `TItem` still sees each item's exact props
const checkItemsBySatisfies = (sf: SourceFile, exportName: string) => {
    if (!sf.getTypeAlias('TItemInfo')?.isExported()) removeAlias(sf, 'TItemInfo');
    // with its leading comments, e.g. a `// test` label
    for (let check = findItemCheck(sf, exportName); check; check = findItemCheck(sf, exportName)) {
        sf.removeText(check.getPos(), check.getEnd());
    }
    const init = sf.getVariableDeclarationOrThrow(exportName).getInitializerOrThrow();
    init.replaceWithText(`${init.getText()} satisfies ${ITEM_INFO_SATISFIES}`);
};

const exportItemInfo = (sp: SourceProject, s: EditSession): boolean => {
    const infoAbs = sp.root.abs(ITEM_INFO_FILE);
    const infoFile = sp.file(infoAbs);
    if (!infoFile || infoFile.getTypeAlias('TItemInfo')?.isExported()) return false;
    if (!infoFile.getTypeAlias('TItemType') || !isConstObject(infoFile.getVariableDeclaration('itemInfo'))) {
        log(`${ITEM_INFO_FILE} has no \`TItemType\` or no \`itemInfo = { … } as const\`; left alone`);
        return false;
    }
    for (const { sf, source } of itemContainers(sp)) {
        const file = sp.root.rel(sf.getFilePath());
        if (!isConstObject(sf.getVariableDeclaration(source))) {
            log(`${file}: \`${source}\` is not \`{ … } as const\`; left alone`);
            continue;
        }
        s.edit(sf.getFilePath());
        checkItemsBySatisfies(sf, source);
        if (sf !== infoFile) {
            ensureNamedImport(sf, 'TItemInfo', relativeModule(sf.getFilePath(), infoAbs), { typeOnly: true });
        }
    }
    const itemType = infoFile.getTypeAliasOrThrow('TItemType');
    infoFile.insertText(itemType.getEnd(), '\n\nexport type TItemInfo = { name: string; type: TItemType };');
    replaceInFile(sp, s, DATA_INDEX, '/* itemInfo, TItemType — ', '/* itemInfo, TItemType, TItemInfo — ');
    return true;
};

/**
 * Moves a story written before the Structure tab onto its layout: `types/literals.ts`, `types/TNpc.ts`
 * and an exported `TItemInfo`. Idempotent; a result that does not type-check is logged and not written.
 */
export const migrateStructureLayout = async (sp: SourceProject, bus: EventBus): Promise<TStructureLayoutStep[]> => {
    const s = sp.session();
    try {
        const steps = s.apply(() => {
            const done: TStructureLayoutStep[] = [];
            if (addLiteralsFile(sp, s)) done.push('literals');
            if (moveNpcTypes(sp, s)) done.push('npcFile');
            if (exportItemInfo(sp, s)) done.push('itemInfo');
            return done;
        });
        if (steps.length === 0) {
            s.rollback();
            return [];
        }
        await s.commit(bus, () => ({
            kind: 'structure',
            id: eventIds.structure,
            version: readStructure(sp).version,
            op: 'updated',
        }));
        return steps;
    } catch (e) {
        s.rollback();
        const diagnostics = isHttpError(e) ? (e.body.diagnostics ?? []) : [];
        const details = diagnostics.map((d) => `\n  ${d.file}:${d.line} ${d.message}`).join('');
        log(`${sp.root.storyId} not migrated: ${e instanceof Error ? e.message : String(e)}${details}`);
        return [];
    }
};
