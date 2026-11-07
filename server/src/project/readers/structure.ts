import path from 'node:path';
import {
    BUILT_IN_REF_TARGETS,
    refIdTypeName,
    refNameAmong,
    refNameOfIdType,
    type TCatalogRefDto,
    type TDiagnosticDto,
    type TFieldDesc,
    type TLiteralDto,
    type TStructKind,
    type TStructTypeDto,
    type TStructureDto,
    type TTypeRef,
} from '@story/protocol';
import {
    type ClassDeclaration,
    Node,
    type ObjectLiteralExpression,
    type PropertyDeclaration,
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

const ENGINE_FILES = new Set(['ids.ts', 'TEngine.ts']);

export const ENGINE_TYPES: ReadonlySet<string> = new Set([
    'TChapter',
    'TChapterPassage',
    'TChapterPassageType',
    'TPassage',
    'TPassageScreen',
    'TPassageStart',
    'TPassageRedirect',
    'TPassageFinish',
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
    Character: ['id', 'name', 'description', 'image', 'startPassageId', 'init'],
    TCharacterData: ['location', 'health', 'inventory'],
    Npc: ['id', 'name', 'description', 'image', 'init'],
    TNpcData: ['location', 'inventory', 'isDead'],
    Location: ['id', 'name', 'description', 'image', 'localCharacters', 'sublocations', 'mapId', 'init'],
    TItemInfo: ['name', 'type'],
};

// the built-in entity types: classes, since they have instances
const EXTENDABLE_CLASSES: ReadonlySet<string> = new Set(['Character', 'Npc', 'Location']);

const LOCATION_REF: TTypeRef = { t: 'ref', name: 'Location' };

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
    Location: { sublocations: { t: 'array', of: LOCATION_REF } },
};

/** The names `typeNodeToRef` resolves: literal aliases, types whose `T<Name>Id` is a `ref`, and story `type`s. */
export type TTypeNames = {
    literals: ReadonlySet<string>;
    refs: ReadonlySet<string>;
    structs: ReadonlySet<string>;
};

const sourceRef = (sp: SourceProject, sf: SourceFile, decl: Node, name: string) => ({
    version: version(sf.getFullText()),
    file: sp.root.rel(sf.getFilePath()),
    line: lineOf(decl),
    exportName: name,
});

const isTypesFile = (sp: SourceProject, sf: SourceFile) =>
    sf.getFilePath().startsWith(`${sp.root.typesDir}${path.sep}`);

/** The class a file under `types/` declares; the file's non-exported types and literals are private to it. */
const ownerClassOf = (sp: SourceProject, sf: SourceFile): string | undefined =>
    isTypesFile(sp, sf)
        ? sf
              .getClasses()
              .find((cls) => cls.isExported())
              ?.getName()
        : undefined;

const privateOwner = (sp: SourceProject, sf: SourceFile, alias: TypeAliasDeclaration): string | undefined =>
    alias.isExported() ? undefined : ownerClassOf(sp, sf);

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
            const ref = sourceRef(sp, sf, alias, alias.getName());
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
            const owner = privateOwner(sp, sf, alias);
            literals.push({
                ...ref,
                name: alias.getName(),
                scope: owner ? 'private' : sf.getFilePath() === globalFile ? 'global' : 'local',
                values: stringUnionValues(alias.getTypeNode()) ?? [],
                ...(owner ? { owner } : {}),
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

const isEngineDeclaration = (sf: SourceFile, name: string) =>
    ENGINE_FILES.has(path.basename(sf.getFilePath())) || ENGINE_TYPES.has(name);

const isStoryTypeAlias = (sp: SourceProject, sf: SourceFile, alias: TypeAliasDeclaration) => {
    const name = alias.getName();
    return (
        (alias.isExported() || privateOwner(sp, sf, alias) !== undefined) &&
        !isLiteralAlias(alias) &&
        !isEngineDeclaration(sf, name) &&
        !(name in EXTENDABLE_FIELDS) &&
        refNameOfIdType(name) === null
    );
};

/** Story types without instances, which a field holds as a nested object. */
const readStructNames = (sp: SourceProject, catalogs: TCatalogSource[]): string[] =>
    typeFiles(sp).flatMap((sf) =>
        typeAliasesOf(sp, sf)
            .filter(
                (alias) =>
                    isStoryTypeAlias(sp, sf, alias) &&
                    alias.getTypeParameters().length === 0 &&
                    Node.isTypeLiteral(alias.getTypeNode()) &&
                    !catalogs.some((c) => c.typeName === alias.getName())
            )
            .map((alias) => alias.getName())
    );

const namesOf = (sp: SourceProject, literals: TLiteralDto[], catalogs: TCatalogSource[]): TTypeNames => ({
    literals: new Set(literals.map((l) => l.name)),
    refs: new Set([...Object.keys(BUILT_IN_REF_TARGETS), ...catalogs.map((c) => c.typeName)]),
    structs: new Set(readStructNames(sp, catalogs)),
});

export const readTypeNames = (sp: SourceProject): TTypeNames =>
    namesOf(sp, readLiterals(sp).literals, readCatalogs(sp));

const codeRef = (node: TypeNode): TTypeRef => ({ t: 'code', code: node.getText() });

const referenceToRef = (node: TypeNode, names: TTypeNames): TTypeRef => {
    if (!Node.isTypeReference(node)) return codeRef(node);
    const name = node.getTypeName().getText();
    const args = node.getTypeArguments();
    if (name === 'Array' && args.length === 1) return { t: 'array', of: typeNodeToRef(args[0], names) };
    if (args.length > 0) return codeRef(node);
    if (names.literals.has(name)) return { t: 'literal', name };
    if (names.structs.has(name)) return { t: 'struct', name };
    const refName = refNameAmong(name, names.refs);
    return refName === undefined ? codeRef(node) : { t: 'ref', name: refName };
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

export const memberKey = (member: PropertySignature | PropertyDeclaration): string | undefined => {
    const name = member.getNameNode();
    if (Node.isIdentifier(name)) return name.getText();
    return Node.isStringLiteral(name) ? name.getLiteralText() : undefined;
};

// a class field is only a field when it is `declare`d: anything else emits code
const isPlainMember = (member: Node): member is PropertySignature | PropertyDeclaration =>
    Node.isPropertySignature(member) ||
    (Node.isPropertyDeclaration(member) &&
        member.hasDeclareKeyword() &&
        !member.isStatic() &&
        !member.hasInitializer() &&
        !member.hasScopeKeyword() &&
        !member.isReadonly());

/** The fields of object members; `undefined` when one is not a plain `key: Type` property. */
const memberFields = (members: readonly Node[], names: TTypeNames): TFieldDesc[] | undefined => {
    const fields: TFieldDesc[] = [];
    for (const member of members) {
        if (!isPlainMember(member)) return undefined;
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

/** The members of an object type; `undefined` when one is not a plain `key: Type` property. */
export const typeLiteralFields = (node: TypeNode | undefined, names: TTypeNames): TFieldDesc[] | undefined =>
    node && Node.isTypeLiteral(node) ? memberFields(node.getMembers(), names) : undefined;

type TDeclaration = { node: TypeAliasDeclaration | ClassDeclaration; name: string };

const declarationFields = ({ node }: TDeclaration, names: TTypeNames): TFieldDesc[] | undefined =>
    Node.isClassDeclaration(node)
        ? memberFields(node.getMembers(), names)
        : typeLiteralFields(node.getTypeNode(), names);

const readExtendable = (base: TStructTypeDto, decl: TDeclaration, names: TTypeNames): TStructTypeDto => {
    const locked = EXTENDABLE_FIELDS[decl.name] ?? [];
    const fields = declarationFields(decl, names);
    if (!fields) return { ...base, code: decl.node.getText() };
    const engineTypes = ENGINE_FIELD_TYPES[decl.name] ?? {};
    return {
        ...base,
        fields: fields.map((field) =>
            locked.includes(field.key) ? { ...field, type: engineTypes[field.key] ?? field.type, locked: true } : field
        ),
    };
};

const builtInKind = (name: string): TStructKind => (EXTENDABLE_CLASSES.has(name) ? 'class' : 'type');

const readStructType = (
    sp: SourceProject,
    sf: SourceFile,
    decl: TDeclaration,
    names: TTypeNames,
    catalogs: TCatalogSource[]
): TStructTypeDto | undefined => {
    const { node, name } = decl;
    const isClass = Node.isClassDeclaration(node);
    const owner = isClass ? undefined : privateOwner(sp, sf, node);
    if (!node.isExported() && owner === undefined) return undefined;
    if (!isClass && isLiteralAlias(node)) return undefined;
    const base = { ...sourceRef(sp, sf, node, name), name, fields: [] };
    if (isEngineDeclaration(sf, name)) {
        return { ...base, kind: builtInKind(name), origin: 'engine', code: node.getText() };
    }
    if (name in EXTENDABLE_FIELDS) {
        return readExtendable({ ...base, kind: builtInKind(name), origin: 'extendable' }, decl, names);
    }
    // the id half of a catalog type, carried by its `catalog.idType`
    if (refNameOfIdType(name)) return undefined;
    const catalog = catalogs.find((c) => c.typeName === name);
    const story: TStructTypeDto = {
        ...base,
        // a story `type` with a catalog has instances, as a class does
        kind: isClass || catalog ? 'class' : 'type',
        origin: 'story',
        ...(owner ? { owner } : {}),
        ...(catalog ? { catalog: { name: catalog.name, file: catalog.file, idType: catalog.idType } } : {}),
    };
    const fields = node.getTypeParameters().length === 0 ? declarationFields(decl, names) : undefined;
    return fields ? { ...story, fields } : { ...story, code: node.getText() };
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

const declarationsOf = (sp: SourceProject, sf: SourceFile): TDeclaration[] => {
    const classes = isTypesFile(sp, sf)
        ? sf.getClasses().flatMap((node) => {
              const name = node.getName();
              return name === undefined ? [] : [{ node, name }];
          })
        : [];
    const aliases = typeAliasesOf(sp, sf).map((node) => ({ node, name: node.getName() }));
    return [...classes, ...aliases].sort((a, b) => a.node.getStart() - b.node.getStart());
};

const readTypes = (
    sp: SourceProject,
    names: TTypeNames = readTypeNames(sp),
    catalogs: TCatalogSource[] = readCatalogs(sp)
): TStructTypeDto[] =>
    typeFiles(sp).flatMap((sf) =>
        declarationsOf(sp, sf).flatMap((decl) => readStructType(sp, sf, decl, names, catalogs) ?? [])
    );

/** One type by name, e.g. an extendable type whose user fields an entity form needs. */
export const readType = (sp: SourceProject, name: string, names: TTypeNames = readTypeNames(sp)) => {
    for (const sf of typeFiles(sp)) {
        const decl = declarationsOf(sp, sf).find((d) => d.name === name);
        if (decl) return readStructType(sp, sf, decl, names, readCatalogs(sp));
    }
    return undefined;
};

/** The fields the author added to an extendable type. */
export const userFieldsOf = (type: TStructTypeDto | undefined): TFieldDesc[] =>
    type?.fields.filter((field) => !field.locked) ?? [];

export const readStructure = (sp: SourceProject): TStructureDto => {
    const { literals, diagnostics } = readLiterals(sp);
    const catalogs = readCatalogs(sp);
    const types = readTypes(sp, namesOf(sp, literals, catalogs), catalogs);
    const files = [...new Set([...literals, ...types, ...catalogs].map((s) => s.file))].sort();
    return {
        version: version(...files.flatMap((file) => [file, sp.text(sp.root.abs(file))])),
        literals,
        types,
        diagnostics,
    };
};

/** The fields of the story `type`s, read once each; what a `struct` value's schema needs. */
export const storyStructFields = (sp: SourceProject, names: TTypeNames = readTypeNames(sp)) => {
    const read = new Map<string, readonly TFieldDesc[]>();
    return (name: string): readonly TFieldDesc[] => {
        const known = read.get(name);
        if (known) return known;
        const type = names.structs.has(name) ? readType(sp, name, names) : undefined;
        const fields = type?.kind === 'type' ? type.fields : [];
        read.set(name, fields);
        return fields;
    };
};
