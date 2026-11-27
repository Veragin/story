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
    type TStructKind,
    type TStructTypeDto,
    type TStructureDto,
    type TUpdateTypeBody,
    type TUpdateTypeDto,
} from '@story/protocol';
import {
    type ClassDeclaration,
    Node,
    type PropertyDeclaration,
    type PropertySignature,
    type SourceFile,
    type TypeAliasDeclaration,
    type TypeLiteralNode,
} from 'ts-morph';
import { HttpError } from '../../common/HttpError';
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
import type { EditSession, SourceProject } from '../SourceProject';
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
import { assertNotRecursive } from './recursiveTypes';
import {
    assertKnownNames,
    assertStructName,
    parseFields,
    parseFlag,
    parseOwnerClass,
    parseRenames,
} from './structureBody';

const CATALOG_NAME_RE = /^[a-z][A-Za-z0-9]*$/;

const typeFile = (name: string) => `types/${name}.ts`;

const catalogFile = (catalog: string) => `${CATALOGS_DIR}/${catalog}.ts`;

const findType = (sp: SourceProject, name: string): TStructTypeDto => {
    const type = readType(sp, name);
    if (!type) throw HttpError.notFound(`No type "${name}"`);
    return type;
};

const parseKind = (value: unknown): TStructKind => {
    if (value === 'class' || value === 'type') return value;
    throw HttpError.badRequest('Field "kind" must be "class" or "type"');
};

// a class always has its catalog: that is where its instances live
const parseCatalog = (sp: SourceProject, value: unknown, structure: TStructureDto): string => {
    const name = typeof value === 'object' && value !== null && 'name' in value ? value.name : undefined;
    if (typeof name !== 'string' || !CATALOG_NAME_RE.test(name)) {
        throw HttpError.badRequest('Field "catalog.name" must be a lower-camel-case identifier (races)');
    }
    const taken =
        structure.types.some((type) => type.catalog?.name === name) || sp.file(sp.root.abs(catalogFile(name)));
    if (taken) throw HttpError.exists(`Catalog "${name}" already exists`);
    return name;
};

// the members are added through the AST, as an update adds them
const classFileText = (
    name: string,
    catalog: string
) => `import type { ${catalog} } from '@story/data/catalogs/${catalog}';

export class ${name} {}

export type ${refIdTypeName(name)} = keyof typeof ${catalog};
`;

const typeFileText = (name: string, fields: TFieldDesc[]) => `export type ${name} = ${objectTypeText(fields)};\n`;

const catalogFileText = (name: string, catalog: string) => `import type { ${name} } from '@story/types';

export const ${catalog} = {} satisfies Record<string, ${name}>;
`;

const createPublicType = (s: EditSession, name: string, fields: TFieldDesc[], catalog: string | undefined) => {
    const { sp } = s;
    const abs = sp.root.abs(typeFile(name));
    if (catalog) {
        const sf = s.create(abs, classFileText(name, catalog));
        const cls = sf.getClassOrThrow(name);
        for (const field of fields) addMember(cls, field);
        ensureTypeImports(sp, sf, fieldTypeNames(fields));
        s.create(sp.root.abs(catalogFile(catalog)), catalogFileText(name, catalog));
    } else {
        ensureTypeImports(sp, s.create(abs, typeFileText(name, fields)), fieldTypeNames(fields));
    }
    barrelAdd(s, `./${name}`);
};

const createPrivateType = (s: EditSession, name: string, fields: TFieldDesc[], owner: TStructTypeDto) => {
    const sf = s.edit(s.sp.root.abs(owner.file));
    sf.addTypeAlias({ name, type: objectTypeText(fields) });
    ensureTypeImports(s.sp, sf, fieldTypeNames(fields));
};

export const createType = ({ sp, bus }: TWriter, rawBody: TCreateTypeBody) =>
    sp.run(async (): Promise<TStructTypeDto> => {
        const body = asBody(rawBody);
        const kind = parseKind(body.kind);
        if (kind === 'type' && body.catalog !== undefined) {
            throw HttpError.badRequest('A type has no catalog; create a class for instances');
        }
        if (kind === 'class' && body.owner !== undefined) {
            throw HttpError.badRequest('A class cannot be private; only types and literals can');
        }
        const structure = readStructure(sp);
        const name = assertStructName(body.name, structure, kind);
        const owner = body.owner === undefined ? undefined : parseOwnerClass(sp, body.owner, structure);
        const catalog = kind === 'class' ? parseCatalog(sp, body.catalog, structure) : undefined;
        const fields = parseFields(body.fields);
        const file = owner?.file ?? typeFile(name);
        // a class's own fields may reference its ids
        assertKnownNames(fields, structure, { file, ...(catalog ? { selfRef: name } : {}) });
        assertNotRecursive(name, fields, structure);
        assertNoIdCycle({ name, catalog: catalog !== undefined }, fields, structure);
        const s = sp.session();
        s.apply(() => {
            if (owner) createPrivateType(s, name, fields, owner);
            else createPublicType(s, name, fields, catalog);
        });
        await s.commit(bus, () => structureEvent(sp, 'created'), { fields: { file: sp.root.abs(file) } });
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

/** A class body or a type's object literal. */
type TMembers = ClassDeclaration | TypeLiteralNode;

type TMember = PropertyDeclaration | PropertySignature;

const membersOf = (sf: SourceFile, name: string): TMembers => {
    const cls = sf.getClass(name);
    if (cls) return cls;
    const node = sf.getTypeAliasOrThrow(name).getTypeNode();
    if (!Node.isTypeLiteral(node)) throw new Error(`${name} is not an object type`);
    return node;
};

const memberOf = (members: TMembers, key: string): TMember | undefined =>
    members.getProperties().find((member: TMember) => memberKey(member) === key);

const addMember = (members: TMembers, field: TFieldDesc) => {
    const property = {
        name: keyText(field.key),
        hasQuestionToken: field.optional,
        type: refToTypeText(field.type),
        ...(field.description ? { docs: [field.description] } : {}),
    };
    // a plain class field would be emitted and initialized: `declare` keeps it a type-only member
    if (Node.isClassDeclaration(members)) members.addProperty({ ...property, hasDeclareKeyword: true });
    else members.addProperty(property);
};

// in place, so an unchanged part keeps its text
const updateMember = (member: TMember, old: TFieldDesc, field: TFieldDesc) => {
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
    const members = membersOf(sf, type.name);
    const inOrder = keptInOrder(type, change);
    for (const key of change.removed) memberOf(members, key)?.remove();
    for (const field of change.userFields) {
        const old = change.sourceOf(field.key);
        const member = old && memberOf(members, old.key);
        if (!old || !member) addMember(members, field);
        else if (inOrder) updateMember(member, old, field);
        else {
            // a reorder appends every author field again in the new order; engine fields stay put
            member.remove();
            addMember(members, field);
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
        assertFieldsEditable(type);
        assertCurrentVersion(body, type);
        const structure = readStructure(sp);
        const fields = parseFields(body.fields);
        const next = withLockedFields(type, fields);
        assertKnownNames(next, structure, { file: type.file });
        assertNotRecursive(name, next, structure);
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
            const instances = typeInstances(sp, type, structure);
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

// the declaration itself is not a use of it
const referencesOf = (node: Node | undefined, own: (sf: SourceFile) => boolean): Node[] => {
    if (!Node.isReferenceFindable(node)) return [];
    const declaration = node.getParentOrThrow();
    return node
        .findReferencesAsNodes()
        .filter((ref) => !own(ref.getSourceFile()) && !declaration.containsRange(ref.getPos(), ref.getEnd()));
};

const declarationOf = (sf: SourceFile, name: string): ClassDeclaration | TypeAliasDeclaration | undefined =>
    sf.getClass(name) ?? sf.getTypeAlias(name);

const typeReferences = (sp: SourceProject, type: TStructTypeDto): TReferenceDto[] => {
    const typeSf = sp.fileOrThrow(sp.root.abs(type.file));
    const catalogSf = type.catalog ? sp.file(sp.root.abs(type.catalog.file)) : undefined;
    const index = sp.root.abs(TYPES_INDEX_FILE);
    // a private type's file is its class's, where a use is a real one
    const own = (sf: SourceFile) =>
        (sf === typeSf && type.owner === undefined) || sf === catalogSf || sf.getFilePath() === index;
    const nodes = [
        ...referencesOf(declarationOf(typeSf, type.name)?.getNameNode(), own),
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

// a class's private types and literals are declared in its file and go with it
const isPrivateOf = (stmt: Node, type: TStructTypeDto) =>
    Node.isTypeAliasDeclaration(stmt) && !stmt.isExported() && stmt.getSourceFile().getClass(type.name) !== undefined;

const isOwnStatement = (stmt: Node, type: TStructTypeDto) =>
    ((Node.isTypeAliasDeclaration(stmt) || Node.isClassDeclaration(stmt)) &&
        (stmt.getName() === type.name || stmt.getName() === type.catalog?.idType)) ||
    isPrivateOf(stmt, type);

// a file holding only the type (its id, its private types) goes with it; anything else written there stays
const ownsFile = (sf: SourceFile, type: TStructTypeDto) =>
    sf.getStatements().every((stmt) => Node.isImportDeclaration(stmt) || isOwnStatement(stmt, type));

export const deleteType = ({ sp, bus }: TWriter, name: string, rawBody: TDeleteTypeBody) =>
    sp.run(async (): Promise<TOkDto> => {
        const body = asBody(rawBody);
        const type = findType(sp, name);
        if (type.origin !== 'story') throw HttpError.forbidden(`${name} is an engine type and cannot be deleted`);
        assertCurrentVersion(body, type);
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
                for (const stmt of sf.getStatements().filter((statement) => isOwnStatement(statement, type))) {
                    removeStatement(stmt);
                }
            }
            if (type.catalog) s.delete(sp.root.abs(type.catalog.file));
        });
        await s.commit(bus, () => structureEvent(sp, 'deleted'), {
            asReferences: (d) => diagnosticsAsReferences(sp, d),
        });
        return { ok: true };
    });
