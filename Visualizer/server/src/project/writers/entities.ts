import {
    isCode,
    type TClearedReferencesDto,
    type TCreateEntityBody,
    type TDeleteEntityBody,
    type TEntityDto,
    type TEntityKind,
    type TFieldDesc,
    type TTypeDefaultContext,
    type TUpdateEntityBody,
    type TValueRecord,
    typeDefault,
} from '@story/visualizer-protocol';
import { Node, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import { version } from '../../events/version';
import { HttpError } from '../../http/HttpError';
import { removeLocationPolygon } from '../../json';
import { siblingPng } from '../images';
import { capitalize } from '@story/shared';
import { deleteClearingReferences, deleteReferences, entityResource, type TDeletePlan } from '../clearReferences';
import { addObjectEntry, entryText } from '../objectCatalog';
import { asObject, getProp, getPropInit, keyText, propertyKey, quote } from '../ast';
import {
    containerForType,
    DATA_TYPE_SUFFIX,
    ENTITY_TYPES,
    entityFields,
    entityOptional,
    findEntitySource,
    findItem,
    itemNodes,
    readEntity,
    readEntitySource,
    readItemNode,
    registerEntriesOf,
    type TItemContainer,
} from '../readers/entities';
import { ITEM_INFO_TYPE, readStructure, userFieldsOf } from '../readers/structure';
import { storyTypeDefaultContext } from '../refIds';
import {
    findImportReferences,
    referenceAt,
    registerAdd,
    registerRemove,
    worldStateAdd,
    worldStateRemove,
} from '../registry';
import type { SourceProject } from '../SourceProject';
import { assertId, chapterCharacterFiles, chapterIds } from '../story';
import { applyPartial, genValue, S, updateValue } from '../values';
import { applyDataType, asBody, assertCurrentVersion, DERIVED_FIELDS, type TWriter } from './common';
import { isRecord } from './structureBody';

type TSourceKind = Exclude<TEntityKind, 'items'>;

const ENTITY_DERIVED = [...DERIVED_FIELDS, 'dataType'];

const NEW_ENTITY: Record<
    TSourceKind,
    {
        file: (id: string) => string;
        exportName: (id: string) => string;
        dataType: (id: string) => string;
        text: (id: string, exportName: string, dataType: string) => string;
        worldState: (id: string, dataType: string) => string;
        storyTypes: string[];
    }
> = {
    characters: {
        file: (id) => `data/characters/${id}.ts`,
        exportName: (id) => capitalize(id),
        dataType: (id) => `T${capitalize(id)}CharacterData`,
        text: (id, exportName, dataType) => `import { TCharacter } from '@story/types';

export const ${exportName}: TCharacter<'${id}'> = {
    id: '${id}',
    name: ${quote(capitalize(id))},

    init: {
        health: 100,
        inventory: [],
    },
};

export type ${dataType} = {};
`,
        worldState: (id, dataType) => `{ ref: TCharacter<'${id}'> } & TCharacterData & Partial<${dataType}>`,
        storyTypes: ['TCharacter', 'TCharacterData'],
    },
    npcs: {
        file: (id) => `data/npcs/${capitalize(id)}.ts`,
        exportName: (id) => capitalize(id),
        dataType: (id) => `T${capitalize(id)}NpcData`,
        text: (id, exportName, dataType) => `import { TNpc } from '@story/types';

export const ${exportName}: TNpc<'${id}'> = {
    id: '${id}',
    name: ${quote(capitalize(id))},
    description: '',

    init: {
        inventory: [],
        location: undefined,
        isDead: false,
    },
};

export type ${dataType} = {};
`,
        worldState: (id, dataType) => `{ ref: TNpc<'${id}'> } & TNpcData & Partial<${dataType}>`,
        storyTypes: ['TNpc', 'TNpcData'],
    },
    locations: {
        file: (id) => `data/locations/${id}.location.ts`,
        exportName: (id) => `${id}Location`,
        dataType: (id) => `T${capitalize(id)}LocationData`,
        text: (id, exportName, dataType) => `import { TLocation } from '@story/types';

export const ${exportName}: TLocation<'${id}'> = {
    id: '${id}',
    name: ${quote(capitalize(id))},
    description: '',

    localCharacters: [],

    init: {},
};

export type ${dataType} = {};
`,
        worldState: (id, dataType) => `{ ref: TLocation<'${id}'> } & ${dataType}`,
        storyTypes: ['TLocation'],
    },
};

const requiredDefaults = (fields: TFieldDesc[], ctx: TTypeDefaultContext): TValueRecord => {
    const out: TValueRecord = {};
    for (const field of fields) {
        const value = field.optional ? null : typeDefault(field.type, ctx);
        if (value !== null) out[field.key] = value;
    }
    return out;
};

// the author's required fields, so a new entity still type-checks after one was added
const userFieldDefaults = (sp: SourceProject) => {
    const structure = readStructure(sp);
    const ctx = storyTypeDefaultContext(sp, structure);
    return (typeName: string | undefined): TValueRecord =>
        requiredDefaults(userFieldsOf(structure.types.find((type) => type.name === typeName)), ctx);
};

const newEntityDefaults = (sp: SourceProject, kind: TSourceKind) => {
    const defaultsOf = userFieldDefaults(sp);
    return { entity: defaultsOf(ENTITY_TYPES[kind].entity), init: defaultsOf(ENTITY_TYPES[kind].data) };
};

const addMissingProps = (obj: ObjectLiteralExpression, values: TValueRecord, sf: SourceFile) => {
    for (const [key, value] of Object.entries(values)) {
        if (getProp(obj, key)) continue;
        obj.addPropertyAssignment({ name: keyText(key), initializer: genValue(value, S.value, { sf, path: key }) });
    }
};

const withUserFields = (body: Record<string, unknown>): Record<string, unknown> => {
    const { userFields, ...rest } = body;
    if (userFields === undefined) return rest;
    if (typeof userFields !== 'object' || userFields === null || Array.isArray(userFields) || isCode(userFields)) {
        throw HttpError.badRequest('Field "userFields" must be an object');
    }
    return { ...rest, ...userFields };
};

const entityEvent = (kind: TEntityKind, id: string, v: string | null, op: 'created' | 'updated' | 'deleted') => ({
    kind: 'entity' as const,
    id: `${kind}/${id}`,
    version: v,
    op,
});

const ITEM_DERIVED = [...DERIVED_FIELDS, 'source'];

const itemProps = (value: unknown): Record<string, unknown> => {
    if (value === undefined) return {};
    if (!isRecord(value) || isCode(value)) throw HttpError.badRequest('Field "props" must be an object');
    return value;
};

const itemText = (sp: SourceProject, c: TItemContainer, dto: Record<string, unknown>) => {
    const ctx = { sf: c.sf, path: '', file: sp.root.rel(c.sf.getFilePath()) };
    const parts: [string, string][] = [
        ['name', genValue(dto.name ?? '', S.string, { ...ctx, path: 'name' })],
        ['type', quote(String(dto.type))],
    ];
    for (const [k, v] of Object.entries(itemProps(dto.props))) {
        if (k === 'name' || k === 'type') throw HttpError.badRequest(`props.${k}: use the "${k}" field`);
        parts.push([k, genValue(v, S.value, { ...ctx, path: `props.${k}` })]);
    }
    return entryText(parts);
};

const itemField =
    (id: string) =>
    (path: string): string | undefined => {
        const [head, key, ...rest] = path.split('.');
        if (head !== id) return undefined;
        if (key === undefined) return undefined;
        if (key === 'name' || key === 'type') return key;
        return ['props', key, ...rest].join('.');
    };

const requireContainer = (sp: SourceProject, type: string): TItemContainer => {
    const container = containerForType(sp, type);
    if (!container) throw new Error('data/items/itemInfo.ts: no `itemInfo` object');
    return container;
};

const createItem = async ({ sp, bus }: TWriter, body: Record<string, unknown>): Promise<TEntityDto> => {
    const id = assertId(body.id, 'id');
    const type = body.type;
    if (typeof type !== 'string' || type === '') throw HttpError.badRequest('Field "type" must be a non-empty string');
    if (itemNodes(sp).some((n) => n.id === id)) throw HttpError.exists(`Item "${id}" already exists`);
    const abs = requireContainer(sp, type).sf.getFilePath();
    const s = sp.session();
    s.apply(() => {
        s.edit(abs);
        const c = requireContainer(sp, type);
        const props = { ...userFieldDefaults(sp)(ITEM_INFO_TYPE), ...itemProps(body.props) };
        addObjectEntry(c.obj, id, itemText(sp, c, { name: id, ...body, props }));
    });
    await s.commit(bus, (texts) => entityEvent('items', id, version(texts.get(abs) ?? sp.text(abs)), 'created'), {
        fields: { file: abs, map: itemField(id) },
    });
    return readItemNode(sp, findItem(sp, id));
};

const updateItem = async ({ sp, bus }: TWriter, id: string, body: Record<string, unknown>): Promise<TEntityDto> => {
    const node = findItem(sp, id);
    const current = readItemNode(sp, node);
    assertCurrentVersion(body, current);
    for (const key of Object.keys(body)) {
        if (!['name', 'type', 'props', ...ITEM_DERIVED].includes(key))
            throw HttpError.badRequest(`Field "${key}" cannot be edited here`);
    }
    const type = body.type === undefined ? current.type : body.type;
    if (typeof type !== 'string' || type === '') throw HttpError.badRequest('Field "type" must be a non-empty string');
    const target = containerForType(sp, type);
    const moves = !!target && target.source !== node.source && body.type !== undefined && body.type !== current.type;
    const files = new Set([node.sf.getFilePath(), ...(moves ? [target.sf.getFilePath()] : [])]);
    const s = sp.session();
    s.apply(() => {
        for (const f of files) s.edit(f);
        const n = findItem(sp, id);
        const ctx = { sf: n.sf, path: '', file: sp.root.rel(n.sf.getFilePath()) };
        if (moves) {
            const merged = { name: current.name, props: current.props, ...body, type };
            n.prop.remove();
            const c = requireContainer(sp, type);
            addObjectEntry(c.obj, id, itemText(sp, c, merged));
            return;
        }
        if (body.name !== undefined) {
            const nameCtx = { ...ctx, path: 'name' };
            const prop = getProp(n.item, 'name');
            if (prop) updateValue(prop.getInitializerOrThrow(), S.string, body.name, nameCtx);
            else
                n.item.insertPropertyAssignment(0, {
                    name: 'name',
                    initializer: genValue(body.name, S.string, nameCtx),
                });
        }
        if (body.type !== undefined && body.type !== current.type) {
            getProp(n.item, 'type')?.getInitializerOrThrow().replaceWithText(quote(type));
        }
        if (body.props !== undefined) {
            const props = itemProps(body.props);
            for (const [k, v] of Object.entries(props)) {
                if (k === 'name' || k === 'type') throw HttpError.badRequest(`props.${k}: use the "${k}" field`);
                const prop = getProp(n.item, k);
                if (prop) updateValue(prop.getInitializerOrThrow(), S.value, v, { ...ctx, path: `props.${k}` });
                else
                    n.item.addPropertyAssignment({
                        name: keyText(k),
                        initializer: genValue(v, S.value, { ...ctx, path: `props.${k}` }),
                    });
            }
            for (const p of [...n.item.getProperties()]) {
                const k = propertyKey(p);
                if (k && k !== 'name' && k !== 'type' && !(k in props) && Node.isPropertyAssignment(p)) p.remove();
            }
        }
    });
    const holder = moves ? target.sf.getFilePath() : node.sf.getFilePath();
    await s.commit(bus, (texts) => entityEvent('items', id, version(texts.get(holder) ?? sp.text(holder)), 'updated'), {
        fields: { file: holder, map: itemField(id) },
    });
    return readItemNode(sp, findItem(sp, id));
};

export const createEntity = ({ sp, bus }: TWriter, kind: TEntityKind, rawBody: TCreateEntityBody) =>
    sp.run(async (): Promise<TEntityDto> => {
        const body = asBody(rawBody);
        if (kind === 'items') return createItem({ sp, bus }, body);
        const id = assertId(body.id, 'id');
        const spec = NEW_ENTITY[kind];
        const abs = sp.root.abs(spec.file(id));
        if (registerEntriesOf(sp, kind).some((e) => e.id === id) || sp.file(abs)) {
            throw HttpError.exists(`${capitalize(kind.slice(0, -1))} "${id}" already exists`);
        }
        const exportName = spec.exportName(id);
        const dataType = spec.dataType(id);
        const s = sp.session();
        s.apply(() => {
            const sf = s.create(abs, spec.text(id, exportName, dataType));
            const obj = asObject(sf.getVariableDeclarationOrThrow(exportName).getInitializer());
            if (!obj) throw new Error(`${spec.file(id)}: no \`${exportName}\` object`);
            const defaults = newEntityDefaults(sp, kind);
            addMissingProps(obj, defaults.entity, sf);
            const init = asObject(getPropInit(obj, 'init'));
            if (init) addMissingProps(init, defaults.init, sf);
            applyPartial(obj, withUserFields(body), entityFields(sp, kind), sf, {
                skip: ENTITY_DERIVED,
                optional: entityOptional(sp, kind),
            });
            applyDataType(sp, sf, body.dataType, DATA_TYPE_SUFFIX[kind], spec.file(id));
            registerAdd(s, kind, id, { importName: exportName, targetFile: abs });
            worldStateAdd(s, kind, id, spec.worldState(id, dataType), {
                dataType,
                targetFile: abs,
                storyTypes: spec.storyTypes,
            });
        });
        await s.commit(bus, (texts) => entityEvent(kind, id, version(texts.get(abs) ?? null), 'created'), {
            fields: { file: abs },
        });
        return readEntity(sp, kind, id);
    });

export const updateEntity = ({ sp, bus }: TWriter, kind: TEntityKind, id: string, rawBody: TUpdateEntityBody) =>
    sp.run(async (): Promise<TEntityDto> => {
        const body = asBody(rawBody);
        if (kind === 'items') return updateItem({ sp, bus }, id, body);
        const src = findEntitySource(sp, kind, id);
        const current = readEntitySource(sp, src);
        assertCurrentVersion(body, current);
        const abs = src.sf.getFilePath();
        const s = sp.session();
        s.apply(() => {
            const sf = s.edit(abs);
            const fresh = findEntitySource(sp, kind, id);
            applyPartial(fresh.obj, withUserFields(body), entityFields(sp, kind), sf, {
                skip: ENTITY_DERIVED,
                optional: entityOptional(sp, kind),
            });
            applyDataType(sp, sf, body.dataType, DATA_TYPE_SUFFIX[kind], current.file);
        });
        await s.commit(bus, (texts) => entityEvent(kind, id, version(texts.get(abs) ?? sp.text(abs)), 'updated'), {
            fields: { file: abs },
        });
        return readEntity(sp, kind, id);
    });

const ENTITY_REF_NAME: Record<TEntityKind, string> = {
    characters: 'TCharacter',
    npcs: 'TNpc',
    locations: 'TLocation',
    items: 'TItem',
};

const itemDeletePlan = (sp: SourceProject, id: string): TDeletePlan => ({
    refName: ENTITY_REF_NAME.items,
    id,
    resource: entityResource('items', id),
    remove: (s) => {
        s.edit(findItem(sp, id).sf.getFilePath());
        findItem(sp, id).prop.remove();
    },
});

const sourceDeletePlan = (sp: SourceProject, kind: TSourceKind, id: string): TDeletePlan => {
    const abs = findEntitySource(sp, kind, id).sf.getFilePath();
    const paths = sp.root.paths;
    const own = (f: string) => f === abs || f === paths.register || f === paths.worldState;
    return {
        refName: ENTITY_REF_NAME[kind],
        id,
        resource: entityResource(kind, id),
        codeReferences: () => [
            ...findImportReferences(sp, abs, own),
            ...(kind === 'characters'
                ? chapterIds(sp).flatMap((ch) =>
                      (chapterCharacterFiles(sp, ch).get(id) ?? []).map((sf) => referenceAt(sp, sf, 1))
                  )
                : []),
        ],
        remove: (s) => {
            s.delete(abs);
            registerRemove(s, kind, id);
            worldStateRemove(s, kind, id);
            if (kind === 'locations') s.after((tx) => removeLocationPolygon(tx, id));
            else s.after((tx) => tx.deleteFile(siblingPng(abs)));
        },
    };
};

const entityDeletePlan = (sp: SourceProject, kind: TEntityKind, id: string): TDeletePlan =>
    kind === 'items' ? itemDeletePlan(sp, id) : sourceDeletePlan(sp, kind, id);

export const deleteEntity = ({ sp, bus }: TWriter, kind: TEntityKind, id: string, rawBody: TDeleteEntityBody) =>
    sp.run((): Promise<TClearedReferencesDto> => {
        assertCurrentVersion(asBody(rawBody), readEntity(sp, kind, id));
        return deleteClearingReferences(
            { sp, bus },
            entityDeletePlan(sp, kind, id),
            entityEvent(kind, id, null, 'deleted'),
            `${capitalize(kind.slice(0, -1))} "${id}" is still referenced`
        );
    });

export const entityDeleteReferences = (sp: SourceProject, kind: TEntityKind, id: string) =>
    sp.run(() => deleteReferences(sp, entityDeletePlan(sp, kind, id)));
