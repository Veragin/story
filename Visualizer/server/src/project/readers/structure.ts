import path from 'node:path';
import {
    BUILT_IN_REF_TARGETS,
    refIdTypeName,
    refNameOfIdType,
    type TCatalogRefDto,
    type TDiagnosticDto,
    type TFieldDesc,
    type TLiteralDto,
    type TStructTypeDto,
    type TStructureDto,
    type TTypeRef,
} from '@story/visualizer-protocol';
import {
    Node,
    type ObjectLiteralExpression,
    type PropertySignature,
    type SourceFile,
    SyntaxKind,
    type TypeAliasDeclaration,
    type TypeNode,
} from 'ts-morph';
import { version } from '../../events/version';
import { asObject, lineOf, propertyKey, readJsDoc, topLevelVariables } from '../ast';
import type { SourceProject } from '../SourceProject';

export const LITERALS_FILE = 'types/literals.ts';
export const TYPES_INDEX_FILE = 'types/index.ts';
export const ITEM_INFO_FILE = 'data/items/itemInfo.ts';
export const ITEM_INFO_TYPE = 'TItemInfo';
export const CATALOGS_DIR = 'data/catalogs';

const ENGINE_FILES = new Set(['ids.ts']);

export const ENGINE_TYPES: ReadonlySet<string> = new Set([
    'TChapter',
    'TChapterPassage',
    'TChapterPassageType',
    'TPassage',
    'TPassageScreen',
    'TPassageTransition',
    'TPassageLinear',
    'TLink',
    'TLinkCost',
    'TTimeTrigger',
    'TItem',
    'TItemId',
    'TItemPartial',
    'TInitInventory',
    'TLocationId',
]);

const EXTENDABLE_FIELDS: Record<string, readonly string[]> = {
    TCharacter: ['id', 'name', 'description', 'image', 'startPassageId', 'init'],
    TCharacterData: ['location', 'health', 'inventory'],
    TNpc: ['id', 'name', 'description', 'image', 'init'],
    TNpcData: ['location', 'inventory', 'isDead'],
    TLocation: ['id', 'name', 'description', 'localCharacters', 'sublocations', 'mapId', 'init'],
    TItemInfo: ['name', 'type'],
};

const LOCATION_REF: TTypeRef = { t: 'ref', name: 'TLocation' };

const INVENTORY_REF: TTypeRef = {
    t: 'array',
    of: {
        t: 'object',
        fields: [
            { key: 'id', type: { t: 'ref', name: 'TItem' }, optional: false },
            { key: 'amount', type: { t: 'number' }, optional: true },
        ],
    },
};

/** Engine fields whose generic text (`TItem<TItemId>[]`) stands for the values an `init` holds. */
const ENGINE_FIELD_TYPES: Readonly<Record<string, Readonly<Record<string, TTypeRef>>>> = {
    TCharacterData: { inventory: INVENTORY_REF },
    TNpcData: { inventory: INVENTORY_REF, location: LOCATION_REF },
    TLocation: { sublocations: { t: 'array', of: LOCATION_REF } },
};

/** The names `typeNodeToRef` resolves: literal aliases, and types whose `T<Name>Id` is a `ref`. */
export type TTypeNames = { literals: ReadonlySet<string>; refs: ReadonlySet<string> };

const sourceRef = (sp: SourceProject, sf: SourceFile, alias: TypeAliasDeclaration) => ({
    version: version(sf.getFullText()),
    file: sp.root.rel(sf.getFilePath()),
    line: lineOf(alias),
    exportName: alias.getName(),
});

const stringLiteralValue = (node: TypeNode): string | undefined => {
    if (!Node.isLiteralTypeNode(node)) return undefined;
    const literal = node.getLiteral();
    return Node.isStringLiteral(literal) || Node.isNoSubstitutionTemplateLiteral(literal)
        ? literal.getLiteralText()
        : undefined;
};

/** `'a' | 'b'` → `['a', 'b']`; `undefined` for anything else. */
const stringUnionValues = (node: TypeNode | undefined): string[] | undefined => {
    if (!node) return undefined;
    const members = Node.isUnionTypeNode(node) ? node.getTypeNodes() : [node];
    const values = members.map(stringLiteralValue);
    return values.every((v) => v !== undefined) ? values : undefined;
};

const isLiteralAlias = (alias: TypeAliasDeclaration) =>
    refNameOfIdType(alias.getName()) === null && stringUnionValues(alias.getTypeNode()) !== undefined;

const literalFiles = (sp: SourceProject): SourceFile[] => {
    const globalFile = sp.root.abs(LITERALS_FILE);
    const files = sp.storyFiles().sort((a, b) => a.getFilePath().localeCompare(b.getFilePath()));
    return [
        ...files.filter((sf) => sf.getFilePath() === globalFile),
        ...files.filter((sf) => sf.getFilePath() !== globalFile),
    ];
};

export const readLiterals = (sp: SourceProject): { literals: TLiteralDto[]; diagnostics: TDiagnosticDto[] } => {
    const globalFile = sp.root.abs(LITERALS_FILE);
    const literals: TLiteralDto[] = [];
    const diagnostics: TDiagnosticDto[] = [];
    for (const sf of literalFiles(sp)) {
        for (const alias of sf.getTypeAliases().filter(isLiteralAlias)) {
            const ref = sourceRef(sp, sf, alias);
            const first = literals.find((l) => l.name === alias.getName());
            if (first) {
                diagnostics.push({
                    file: ref.file,
                    line: ref.line,
                    column: 1,
                    message: `Literal "${alias.getName()}" is already declared in ${first.file}; this one is ignored`,
                });
                continue;
            }
            literals.push({
                ...ref,
                name: alias.getName(),
                scope: sf.getFilePath() === globalFile ? 'global' : 'local',
                values: stringUnionValues(alias.getTypeNode()) ?? [],
            });
        }
    }
    return { literals, diagnostics };
};

const recordValueTypeName = (node: TypeNode | undefined): string | undefined => {
    if (!node || !Node.isTypeReference(node) || node.getTypeName().getText() !== 'Record') return undefined;
    const [key, value] = node.getTypeArguments();
    if (key?.getKind() !== SyntaxKind.StringKeyword || !value || !Node.isTypeReference(value)) return undefined;
    return value.getTypeArguments().length === 0 ? value.getTypeName().getText() : undefined;
};

const satisfiedTypeName = (node: Node | undefined): string | undefined => {
    if (Node.isSatisfiesExpression(node)) {
        return recordValueTypeName(node.getTypeNode()) ?? satisfiedTypeName(node.getExpression());
    }
    if (Node.isParenthesizedExpression(node) || Node.isAsExpression(node)) {
        return satisfiedTypeName(node.getExpression());
    }
    return undefined;
};

export type TCatalogSource = TCatalogRefDto & { typeName: string; sf: SourceFile };

/** `data/catalogs/*.ts` exports that `satisfies Record<string, TName>`, by convention. */
export const readCatalogs = (sp: SourceProject): TCatalogSource[] =>
    sp.filesUnder(sp.root.abs(CATALOGS_DIR)).flatMap((sf) =>
        topLevelVariables(sf).flatMap((decl) => {
            const typeName = decl.isExported() ? satisfiedTypeName(decl.getInitializer()) : undefined;
            if (!typeName) return [];
            return [
                {
                    name: decl.getName(),
                    file: sp.root.rel(sf.getFilePath()),
                    idType: refIdTypeName(typeName),
                    typeName,
                    sf,
                },
            ];
        })
    );

/** The `{ id: entry }` object of a catalog. */
export const catalogObject = (sp: SourceProject, catalog: string): ObjectLiteralExpression | undefined => {
    const source = readCatalogs(sp).find((c) => c.name === catalog);
    return asObject(source?.sf.getVariableDeclaration(catalog)?.getInitializer());
};

/** The entry ids of a catalog, in file order. */
export const catalogIds = (sp: SourceProject, catalog: string): string[] =>
    catalogObject(sp, catalog)
        ?.getProperties()
        .flatMap((p) => propertyKey(p) ?? []) ?? [];

const namesOf = (literals: TLiteralDto[], catalogs: TCatalogSource[]): TTypeNames => ({
    literals: new Set(literals.map((l) => l.name)),
    refs: new Set([...Object.keys(BUILT_IN_REF_TARGETS), ...catalogs.map((c) => c.typeName)]),
});

export const readTypeNames = (sp: SourceProject): TTypeNames => namesOf(readLiterals(sp).literals, readCatalogs(sp));

const codeRef = (node: TypeNode): TTypeRef => ({ t: 'code', code: node.getText() });

const referenceToRef = (node: TypeNode, names: TTypeNames): TTypeRef => {
    if (!Node.isTypeReference(node)) return codeRef(node);
    const name = node.getTypeName().getText();
    const args = node.getTypeArguments();
    if (name === 'Array' && args.length === 1) return { t: 'array', of: typeNodeToRef(args[0], names) };
    if (args.length > 0) return codeRef(node);
    if (names.literals.has(name)) return { t: 'literal', name };
    const refName = refNameOfIdType(name);
    if (refName && names.refs.has(refName)) return { t: 'ref', name: refName };
    return codeRef(node);
};

const typeNodeToRef = (node: TypeNode, names: TTypeNames): TTypeRef => {
    if (Node.isParenthesizedTypeNode(node)) return typeNodeToRef(node.getTypeNode(), names);
    switch (node.getKind()) {
        case SyntaxKind.StringKeyword:
            return { t: 'string' };
        case SyntaxKind.NumberKeyword:
            return { t: 'number' };
        case SyntaxKind.BooleanKeyword:
            return { t: 'boolean' };
    }
    if (Node.isArrayTypeNode(node)) return { t: 'array', of: typeNodeToRef(node.getElementTypeNode(), names) };
    if (Node.isTypeReference(node)) return referenceToRef(node, names);
    if (Node.isFunctionTypeNode(node)) return { t: 'function', signature: node.getText() };
    if (Node.isTypeLiteral(node)) {
        const fields = typeLiteralFields(node, names);
        if (fields) return { t: 'object', fields };
    }
    return codeRef(node);
};

export const memberKey = (member: PropertySignature): string | undefined => {
    const name = member.getNameNode();
    if (Node.isIdentifier(name)) return name.getText();
    return Node.isStringLiteral(name) ? name.getLiteralText() : undefined;
};

/** The members of an object type; `undefined` when one is not a plain `key: Type` property. */
export const typeLiteralFields = (node: TypeNode | undefined, names: TTypeNames): TFieldDesc[] | undefined => {
    if (!node || !Node.isTypeLiteral(node)) return undefined;
    const fields: TFieldDesc[] = [];
    for (const member of node.getMembers()) {
        if (!Node.isPropertySignature(member)) return undefined;
        const key = memberKey(member);
        const typeNode = member.getTypeNode();
        if (key === undefined || !typeNode) return undefined;
        const description = readJsDoc(member);
        fields.push({
            key,
            type: typeNodeToRef(typeNode, names),
            optional: member.hasQuestionToken(),
            ...(description === undefined ? {} : { description }),
        });
    }
    return fields;
};

const readExtendable = (base: TStructTypeDto, alias: TypeAliasDeclaration, names: TTypeNames): TStructTypeDto => {
    const locked = EXTENDABLE_FIELDS[alias.getName()] ?? [];
    const fields = typeLiteralFields(alias.getTypeNode(), names);
    if (!fields) return { ...base, code: alias.getText() };
    const engineTypes = ENGINE_FIELD_TYPES[alias.getName()] ?? {};
    return {
        ...base,
        fields: fields.map((field) =>
            locked.includes(field.key) ? { ...field, type: engineTypes[field.key] ?? field.type, locked: true } : field
        ),
    };
};

const readStructType = (
    sp: SourceProject,
    sf: SourceFile,
    alias: TypeAliasDeclaration,
    names: TTypeNames,
    catalogs: TCatalogSource[]
): TStructTypeDto | undefined => {
    const name = alias.getName();
    if (!alias.isExported() || isLiteralAlias(alias)) return undefined;
    const base = { ...sourceRef(sp, sf, alias), name, fields: [] };
    if (ENGINE_FILES.has(path.basename(sf.getFilePath())) || ENGINE_TYPES.has(name)) {
        return { ...base, origin: 'engine', code: alias.getText() };
    }
    if (name in EXTENDABLE_FIELDS) return readExtendable({ ...base, origin: 'extendable' }, alias, names);
    // the id half of a catalog type, carried by its `catalog.idType`
    if (refNameOfIdType(name)) return undefined;
    const catalog = catalogs.find((c) => c.typeName === name);
    const story: TStructTypeDto = {
        ...base,
        origin: 'story',
        ...(catalog ? { catalog: { name: catalog.name, file: catalog.file, idType: catalog.idType } } : {}),
    };
    const fields = alias.getTypeParameters().length === 0 ? typeLiteralFields(alias.getTypeNode(), names) : undefined;
    return fields ? { ...story, fields } : { ...story, code: alias.getText() };
};

const typeFiles = (sp: SourceProject): SourceFile[] => {
    const itemInfo = sp.file(sp.root.abs(ITEM_INFO_FILE));
    return [
        ...sp.filesUnder(sp.root.typesDir).sort((a, b) => a.getFilePath().localeCompare(b.getFilePath())),
        ...(itemInfo ? [itemInfo] : []),
    ];
};

const typeAliasesOf = (sp: SourceProject, sf: SourceFile): TypeAliasDeclaration[] =>
    sf.getFilePath() === sp.root.abs(ITEM_INFO_FILE)
        ? sf.getTypeAliases().filter((a) => a.getName() === ITEM_INFO_TYPE)
        : sf.getTypeAliases();

const readTypes = (
    sp: SourceProject,
    names: TTypeNames = readTypeNames(sp),
    catalogs: TCatalogSource[] = readCatalogs(sp)
): TStructTypeDto[] =>
    typeFiles(sp).flatMap((sf) =>
        typeAliasesOf(sp, sf).flatMap((alias) => readStructType(sp, sf, alias, names, catalogs) ?? [])
    );

/** One type by name, e.g. an extendable type whose user fields an entity form needs. */
export const readType = (sp: SourceProject, name: string, names: TTypeNames = readTypeNames(sp)) => {
    for (const sf of typeFiles(sp)) {
        const alias = typeAliasesOf(sp, sf).find((a) => a.getName() === name);
        if (alias) return readStructType(sp, sf, alias, names, readCatalogs(sp));
    }
    return undefined;
};

/** The fields the author added to an extendable type. */
export const userFieldsOf = (type: TStructTypeDto | undefined): TFieldDesc[] =>
    type?.fields.filter((field) => !field.locked) ?? [];

export const readStructure = (sp: SourceProject): TStructureDto => {
    const { literals, diagnostics } = readLiterals(sp);
    const catalogs = readCatalogs(sp);
    const types = readTypes(sp, namesOf(literals, catalogs), catalogs);
    const files = [...new Set([...literals, ...types, ...catalogs].map((s) => s.file))].sort();
    return {
        version: version(...files.flatMap((file) => [file, sp.text(sp.root.abs(file))])),
        literals,
        types,
        diagnostics,
    };
};
