import {
    fieldTypeNames,
    objectTypeText,
    refIdTypeName,
    refToTypeText,
    sameTypeRef,
    type TCreateTypeBody,
    type TDeleteTypeBody,
    type TFieldDesc,
    type TOkDto,
    type TReferenceDto,
    type TStructTypeDto,
    type TStructureDto,
    type TUpdateTypeBody,
    type TUpdateTypeDto,
} from '@story/visualizer-protocol';
import { Node, type PropertySignature, type SourceFile, type TypeLiteralNode } from 'ts-morph';
import { HttpError } from '../../http/HttpError';
import { keyText, lineOf, removeStatement } from '../ast';
import {
    CATALOGS_DIR,
    catalogObject,
    memberKey,
    readStructure,
    readType,
    TYPES_INDEX_FILE,
} from '../readers/structure';
import { storyTypeDefaultContext } from '../refIds';
import { dedupe, diagnosticsAsReferences, referenceAt } from '../registry';
import type { SourceProject } from '../SourceProject';
import { migrateInstance, type TInstanceChange, typeInstances } from '../typeInstances';
import { ensureTypeImports } from '../typeText';
import {
    asBody,
    assertCurrentVersion,
    barrelAdd,
    barrelRemove,
    emitWrittenResources,
    structureEvent,
    type TWriter,
} from './common';
import { assertNoIdCycle } from './idCycles';
import { assertKnownNames, assertStructName, parseFields, parseFlag, parseRenames } from './structureBody';

const CATALOG_NAME_RE = /^[a-z][A-Za-z0-9]*$/;

const typeFile = (name: string) => `types/${name}.ts`;

const catalogFile = (catalog: string) => `${CATALOGS_DIR}/${catalog}.ts`;

const findType = (sp: SourceProject, name: string): TStructTypeDto => {
    const type = readType(sp, name);
    if (!type) throw HttpError.notFound(`No type "${name}"`);
    return type;
};

const parseCatalog = (sp: SourceProject, value: unknown, structure: TStructureDto): string | undefined => {
    if (value === undefined) return undefined;
    const name = typeof value === 'object' && value !== null && 'name' in value ? value.name : undefined;
    if (typeof name !== 'string' || !CATALOG_NAME_RE.test(name)) {
        throw HttpError.badRequest('Field "catalog.name" must be a lower-camel-case identifier (races)');
    }
    const taken =
        structure.types.some((type) => type.catalog?.name === name) || sp.file(sp.root.abs(catalogFile(name)));
    if (taken) throw HttpError.exists(`Catalog "${name}" already exists`);
    return name;
};

const typeFileText = (name: string, fields: TFieldDesc[], catalog: string | undefined) => {
    const type = `export type ${name} = ${objectTypeText(fields)};\n`;
    if (!catalog) return type;
    return `import type { ${catalog} } from '@story/data/catalogs/${catalog}';

${type}
export type ${refIdTypeName(name)} = keyof typeof ${catalog};
`;
};

const catalogFileText = (name: string, catalog: string) => `import type { ${name} } from '@story/types';

export const ${catalog} = {} satisfies Record<string, ${name}>;
`;

export const createType = ({ sp, bus }: TWriter, rawBody: TCreateTypeBody) =>
    sp.run(async (): Promise<TStructTypeDto> => {
        const body = asBody(rawBody);
        const structure = readStructure(sp);
        const name = assertStructName(body.name, structure);
        const catalog = parseCatalog(sp, body.catalog, structure);
        const fields = parseFields(body.fields);
        // with a catalog, the new type's own fields may reference its ids
        assertKnownNames(fields, structure, catalog ? name : undefined);
        assertNoIdCycle({ name, catalog: catalog !== undefined }, fields, structure);
        const abs = sp.root.abs(typeFile(name));
        const s = sp.session();
        s.apply(() => {
            const sf = s.create(abs, typeFileText(name, fields, catalog));
            ensureTypeImports(sp, sf, fieldTypeNames(fields));
            if (catalog) s.create(sp.root.abs(catalogFile(catalog)), catalogFileText(name, catalog));
            barrelAdd(s, `./${name}`);
        });
        await s.commit(bus, () => structureEvent(sp, 'created'), { fields: { file: abs } });
        return findType(sp, name);
    });

const assertFieldsEditable = (type: TStructTypeDto) => {
    if (type.origin === 'engine') throw HttpError.forbidden(`${type.name} is an engine type`);
    if (type.code !== undefined) {
        throw HttpError.badRequest(`${type.name} is not a plain object type; edit its source instead`);
    }
};

// the engine fields stay as they are; only the author's fields come from the body
const withLockedFields = (type: TStructTypeDto, fields: TFieldDesc[]): TFieldDesc[] => {
    const locked = type.fields.filter((field) => field.locked);
    for (const field of fields) {
        const old = locked.find((l) => l.key === field.key);
        if (old && (old.optional !== field.optional || !sameTypeRef(old.type, field.type))) {
            throw HttpError.badRequest(`Field "${field.key}" is used by the engine and cannot be changed`);
        }
    }
    return [...locked, ...fields.filter((field) => !locked.some((l) => l.key === field.key))];
};

type TTypeChange = TInstanceChange & {
    /** New user field → the old field it continues, if any. */
    sourceOf: (key: string) => TFieldDesc | undefined;
    userFields: TFieldDesc[];
};

const typeChange = (
    type: TStructTypeDto,
    next: TFieldDesc[],
    renames: [string, string][],
    resetIncompatible: boolean
): TTypeChange => {
    const oldUser = type.fields.filter((field) => !field.locked);
    const userFields = next.filter((field) => !field.locked);
    for (const [from, to] of renames) {
        if (!oldUser.some((field) => field.key === from)) throw HttpError.badRequest(`renames: no field "${from}"`);
        if (!userFields.some((field) => field.key === to)) throw HttpError.badRequest(`renames: no field "${to}"`);
        if (userFields.some((field) => field.key === from)) {
            throw HttpError.badRequest(`renames: "${from}" is renamed but also kept`);
        }
    }
    const sourceKey = (key: string) => renames.find(([, to]) => to === key)?.[0] ?? key;
    const sourceOf = (key: string) => oldUser.find((field) => field.key === sourceKey(key));
    const changed = userFields.filter((field) => {
        const old = sourceOf(field.key);
        return old !== undefined && !sameTypeRef(old.type, field.type);
    });
    return {
        renames,
        removed: oldUser
            .filter((old) => !userFields.some((field) => sourceOf(field.key) === old))
            .map((old) => old.key),
        reset: resetIncompatible ? changed : [],
        required: userFields.filter((field) => !field.optional),
        sourceOf,
        userFields,
    };
};

const typeLiteralOf = (sf: SourceFile, name: string): TypeLiteralNode => {
    const node = sf.getTypeAliasOrThrow(name).getTypeNode();
    if (!Node.isTypeLiteral(node)) throw new Error(`${name} is not an object type`);
    return node;
};

const memberOf = (literal: TypeLiteralNode, key: string): PropertySignature | undefined =>
    literal.getProperties().find((member) => memberKey(member) === key);

const addMember = (literal: TypeLiteralNode, field: TFieldDesc) => {
    literal.addProperty({
        name: keyText(field.key),
        hasQuestionToken: field.optional,
        type: refToTypeText(field.type),
        ...(field.description ? { docs: [field.description] } : {}),
    });
};

// in place, so an unchanged part keeps its text
const updateMember = (member: PropertySignature, old: TFieldDesc, field: TFieldDesc) => {
    if (old.description !== field.description) {
        for (const doc of member.getJsDocs()) doc.remove();
        if (field.description) member.addJsDoc(field.description);
    }
    if (!sameTypeRef(old.type, field.type)) member.setType(refToTypeText(field.type));
    if (old.optional !== field.optional) member.setHasQuestionToken(field.optional);
    if (old.key !== field.key) member.getNameNode().replaceWithText(keyText(field.key));
};

const keptInOrder = (type: TStructTypeDto, change: TTypeChange): boolean => {
    const kept = change.userFields.flatMap((field) => change.sourceOf(field.key) ?? []);
    const before = type.fields.filter((field) => kept.includes(field));
    return kept.every((field, i) => before[i] === field);
};

const rewriteMembers = (sf: SourceFile, type: TStructTypeDto, change: TTypeChange) => {
    const literal = typeLiteralOf(sf, type.name);
    const inOrder = keptInOrder(type, change);
    for (const key of change.removed) memberOf(literal, key)?.remove();
    for (const field of change.userFields) {
        const old = change.sourceOf(field.key);
        const member = old && memberOf(literal, old.key);
        if (!old || !member) addMember(literal, field);
        else if (inOrder) updateMember(member, old, field);
        else {
            // a reorder appends every author field again in the new order; engine fields stay put
            member.remove();
            addMember(literal, field);
        }
    }
};

const instanceFiles = (objects: { getSourceFile(): SourceFile }[]) => [
    ...new Set(objects.map((obj) => obj.getSourceFile().getFilePath())),
];

export const updateType = ({ sp, bus }: TWriter, name: string, rawBody: TUpdateTypeBody) =>
    sp.run(async (): Promise<TUpdateTypeDto> => {
        const body = asBody(rawBody);
        const type = findType(sp, name);
        assertCurrentVersion(body, type);
        assertFieldsEditable(type);
        const structure = readStructure(sp);
        const fields = parseFields(body.fields);
        const next = withLockedFields(type, fields);
        assertKnownNames(next, structure);
        assertNoIdCycle({ name, catalog: type.catalog !== undefined }, fields, structure);
        const change = typeChange(
            type,
            next,
            parseRenames(body.renames),
            parseFlag(body.resetIncompatible, 'resetIncompatible')
        );
        const ctx = storyTypeDefaultContext(sp, structure);
        const abs = sp.root.abs(type.file);
        const s = sp.session();
        s.apply(() => {
            const instances = typeInstances(sp, type);
            for (const file of instanceFiles(instances.objects)) s.edit(file);
            const instanceChange = instances.openProps ? { ...change, removed: [] } : change;
            for (const obj of instances.objects) migrateInstance(obj, instanceChange, ctx);
            const sf = s.edit(abs);
            rewriteMembers(sf, type, change);
            ensureTypeImports(sp, sf, fieldTypeNames(change.userFields));
        });
        const written = await s.commit(bus, () => structureEvent(sp, 'updated'), { fields: { file: abs } });
        emitWrittenResources(bus, sp, written);
        return {
            type: findType(sp, name),
            touchedFiles: [...written.keys()]
                .filter((file) => file !== abs)
                .map((file) => sp.root.rel(file))
                .sort(),
        };
    });

const referencesOf = (node: Node | undefined, own: (sf: SourceFile) => boolean): Node[] =>
    Node.isReferenceFindable(node) ? node.findReferencesAsNodes().filter((ref) => !own(ref.getSourceFile())) : [];

const typeReferences = (sp: SourceProject, type: TStructTypeDto): TReferenceDto[] => {
    const typeSf = sp.fileOrThrow(sp.root.abs(type.file));
    const catalogSf = type.catalog ? sp.file(sp.root.abs(type.catalog.file)) : undefined;
    const index = sp.root.abs(TYPES_INDEX_FILE);
    const own = (sf: SourceFile) => sf === typeSf || sf === catalogSf || sf.getFilePath() === index;
    const nodes = [
        ...referencesOf(typeSf.getTypeAlias(type.name)?.getNameNode(), own),
        ...(type.catalog
            ? [
                  ...referencesOf(typeSf.getTypeAlias(type.catalog.idType)?.getNameNode(), own),
                  ...referencesOf(catalogSf?.getVariableDeclaration(type.catalog.name)?.getNameNode(), own),
              ]
            : []),
    ];
    const entries = type.catalog ? (catalogObject(sp, type.catalog.name)?.getProperties() ?? []) : [];
    return dedupe([...nodes, ...entries].map((node) => referenceAt(sp, node.getSourceFile(), lineOf(node))));
};

// a file holding only the type (and its id) goes with it; anything else written there stays
const ownsFile = (sf: SourceFile, type: TStructTypeDto) =>
    sf
        .getStatements()
        .every(
            (stmt) =>
                Node.isImportDeclaration(stmt) ||
                (Node.isTypeAliasDeclaration(stmt) &&
                    (stmt.getName() === type.name || stmt.getName() === type.catalog?.idType))
        );

export const deleteType = ({ sp, bus }: TWriter, name: string, rawBody: TDeleteTypeBody) =>
    sp.run(async (): Promise<TOkDto> => {
        const body = asBody(rawBody);
        const type = findType(sp, name);
        assertCurrentVersion(body, type);
        if (type.origin !== 'story') throw HttpError.forbidden(`${name} is an engine type and cannot be deleted`);
        const refs = typeReferences(sp, type);
        if (refs.length > 0) throw HttpError.referenced(refs, `Type "${name}" is still used`);
        const abs = sp.root.abs(type.file);
        const s = sp.session();
        s.apply(() => {
            const sf = s.edit(abs);
            if (ownsFile(sf, type)) {
                const module = sf.getBaseNameWithoutExtension();
                s.delete(abs);
                barrelRemove(s, `./${module}`);
            } else {
                for (const alias of [type.name, type.catalog?.idType]) {
                    const decl = alias ? sf.getTypeAlias(alias) : undefined;
                    if (decl) removeStatement(decl);
                }
            }
            if (type.catalog) s.delete(sp.root.abs(type.catalog.file));
        });
        await s.commit(bus, () => structureEvent(sp, 'deleted'), {
            asReferences: (d) => diagnosticsAsReferences(sp, d),
        });
        return { ok: true };
    });
