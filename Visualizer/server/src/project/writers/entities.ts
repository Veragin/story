import {
    isCode,
    type TCreateEntityBody,
    type TDeleteEntityBody,
    type TEntityDto,
    type TEntityKind,
    type TOkDto,
    type TReferenceDto,
    type TUpdateEntityBody,
} from '@story/visualizer-protocol';
import { Node } from 'ts-morph';
import { assertVersion, version } from '../../events/version';
import { HttpError } from '../../http/HttpError';
import { removeLocationPolygon } from '../../json';
import { siblingPng } from '../images';
import { asObject, cap, getProp, keyText, propertyKey, quote } from '../ast';
import {
    containerForType,
    DATA_TYPE_SUFFIX,
    ENTITY_OPTIONAL,
    entityFields,
    findEntitySource,
    findItem,
    itemNodes,
    readEntity,
    readEntitySource,
    readItemNode,
    registerEntriesOf,
    type TItemContainer,
} from '../readers/entities';
import {
    dedupe,
    diagnosticsAsReferences,
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
import { applyDataType, asBody, DERIVED_FIELDS, type TWriter } from './common';

type TSourceKind = Exclude<TEntityKind, 'items'>;

const ENTITY_DERIVED = [...DERIVED_FIELDS, 'dataType'];

/** Where a new entity goes, what it exports, and its skeleton (plan §2 "Data model"). */
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
        exportName: (id) => cap(id),
        dataType: (id) => `T${cap(id)}CharacterData`,
        text: (id, exportName, dataType) => `import { TCharacter } from '@story/types';

export const ${exportName}: TCharacter<'${id}'> = {
    id: '${id}',
    name: ${quote(cap(id))},

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
        file: (id) => `data/npcs/${cap(id)}.ts`,
        exportName: (id) => cap(id),
        dataType: (id) => `T${cap(id)}NpcData`,
        text: (id, exportName, dataType) => `import { TNpc } from '@story/types';

export const ${exportName}: TNpc<'${id}'> = {
    id: '${id}',
    name: ${quote(cap(id))},
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
        dataType: (id) => `T${cap(id)}LocationData`,
        text: (id, exportName, dataType) => `import { TLocation } from '@story/types';

export const ${exportName}: TLocation<'${id}'> = {
    id: '${id}',
    name: ${quote(cap(id))},
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

const entityEvent = (kind: TEntityKind, id: string, v: string | null, op: 'created' | 'updated' | 'deleted') => ({
    kind: 'entity' as const,
    id: `${kind}/${id}`,
    version: v,
    op,
});

// ---------------------------------------------------------------------------------------------
// Items

const ITEM_DERIVED = [...DERIVED_FIELDS, 'source'];

const itemText = (sp: SourceProject, c: TItemContainer, dto: Record<string, unknown>) => {
    const ctx = { sf: c.sf, path: '', file: sp.root.rel(c.sf.getFilePath()) };
    const parts = [
        `name: ${genValue(dto.name ?? '', S.string, { ...ctx, path: 'name' })}`,
        `type: ${quote(String(dto.type))}`,
    ];
    const props = (dto.props ?? {}) as Record<string, unknown>;
    if (typeof props !== 'object' || props === null || Array.isArray(props)) {
        throw HttpError.badRequest('Field "props" must be an object');
    }
    for (const [k, v] of Object.entries(props)) {
        if (k === 'name' || k === 'type') throw HttpError.badRequest(`props.${k}: use the "${k}" field`);
        parts.push(`${keyText(k)}: ${genValue(v, S.value, { ...ctx, path: `props.${k}` })}`);
    }
    return `{ ${parts.join(', ')} }`;
};

/** `bow.damage` (a path in the items object) → `props.damage`; other items' paths are dropped. */
const itemField =
    (id: string) =>
    (path: string): string | undefined => {
        const [head, key, ...rest] = path.split('.');
        if (head !== id) return undefined;
        if (key === undefined) return undefined;
        if (key === 'name' || key === 'type') return key;
        return ['props', key, ...rest].join('.');
    };

const createItem = async ({ sp, bus }: TWriter, body: Record<string, unknown>): Promise<TEntityDto> => {
    const id = assertId(body.id, 'id');
    if (typeof body.type !== 'string' || body.type === '')
        throw HttpError.badRequest('Field "type" must be a non-empty string');
    if (itemNodes(sp).some((n) => n.id === id)) throw HttpError.exists(`Item "${id}" already exists`);
    const container = containerForType(sp, body.type);
    if (!container) throw new Error('data/items/itemInfo.ts: no `itemInfo` object');
    const abs = container.sf.getFilePath();
    const s = sp.session();
    s.apply(() => {
        s.edit(abs);
        const c = containerForType(sp, body.type as string)!;
        c.obj.addPropertyAssignment({ name: keyText(id), initializer: itemText(sp, c, { name: id, ...body }) });
    });
    await s.commit(bus, (texts) => entityEvent('items', id, version(texts.get(abs) ?? sp.text(abs)), 'created'), {
        fields: { file: abs, map: itemField(id) },
    });
    return readItemNode(sp, findItem(sp, id));
};

const updateItem = async ({ sp, bus }: TWriter, id: string, body: Record<string, unknown>): Promise<TEntityDto> => {
    const node = findItem(sp, id);
    const current = readItemNode(sp, node);
    await assertVersion(body.version as string, current.version, () => current);
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
            const c = containerForType(sp, type)!;
            c.obj.addPropertyAssignment({ name: keyText(id), initializer: itemText(sp, c, merged) });
            return;
        }
        if (body.name !== undefined) {
            const nameCtx = { ...ctx, path: 'name' };
            const prop = getProp(n.item, 'name');
            // `name` is optional on disk (the reader falls back to the id): add it when missing.
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
            const props = body.props as Record<string, unknown>;
            if (typeof props !== 'object' || props === null || Array.isArray(props) || isCode(props)) {
                throw HttpError.badRequest('Field "props" must be an object');
            }
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

const deleteItem = async ({ sp, bus }: TWriter, id: string, body: Record<string, unknown>): Promise<TOkDto> => {
    const node = findItem(sp, id);
    const current = readItemNode(sp, node);
    await assertVersion(body.version as string, current.version, () => current);
    const s = sp.session();
    s.apply(() => {
        s.edit(node.sf.getFilePath());
        findItem(sp, id).prop.remove();
    });
    // `TItemId` is `keyof typeof itemInfo`: every inventory / cost that names the item stops compiling
    await s.commit(bus, () => entityEvent('items', id, null, 'deleted'), {
        asReferences: (d) => diagnosticsAsReferences(sp, d),
    });
    return { ok: true };
};

// ---------------------------------------------------------------------------------------------

export const createEntity = ({ sp, bus }: TWriter, kind: TEntityKind, rawBody: TCreateEntityBody) =>
    sp.run(async (): Promise<TEntityDto> => {
        const body = asBody(rawBody);
        if (kind === 'items') return createItem({ sp, bus }, body);
        const id = assertId(body.id, 'id');
        const spec = NEW_ENTITY[kind];
        const abs = sp.root.abs(spec.file(id));
        if (registerEntriesOf(sp, kind).some((e) => e.id === id) || sp.file(abs)) {
            throw HttpError.exists(`${cap(kind.slice(0, -1))} "${id}" already exists`);
        }
        const exportName = spec.exportName(id);
        const dataType = spec.dataType(id);
        const s = sp.session();
        s.apply(() => {
            const sf = s.create(abs, spec.text(id, exportName, dataType));
            const obj = asObject(sf.getVariableDeclarationOrThrow(exportName).getInitializer())!;
            applyPartial(obj, body, entityFields(sp, kind), sf, {
                skip: ENTITY_DERIVED,
                optional: ENTITY_OPTIONAL[kind],
            });
            applyDataType(sf, body.dataType, DATA_TYPE_SUFFIX[kind], spec.file(id));
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
        await assertVersion(body.version as string, current.version, () => current);
        const abs = src.sf.getFilePath();
        const s = sp.session();
        s.apply(() => {
            const sf = s.edit(abs);
            const fresh = findEntitySource(sp, kind, id);
            applyPartial(fresh.obj, body, entityFields(sp, kind), sf, {
                skip: ENTITY_DERIVED,
                optional: ENTITY_OPTIONAL[kind],
            });
            applyDataType(sf, body.dataType, DATA_TYPE_SUFFIX[kind], current.file);
        });
        await s.commit(bus, (texts) => entityEvent(kind, id, version(texts.get(abs) ?? sp.text(abs)), 'updated'), {
            fields: { file: abs },
        });
        return readEntity(sp, kind, id);
    });

export const deleteEntity = ({ sp, bus }: TWriter, kind: TEntityKind, id: string, rawBody: TDeleteEntityBody) =>
    sp.run(async (): Promise<TOkDto> => {
        const body = asBody(rawBody);
        if (kind === 'items') return deleteItem({ sp, bus }, id, body);
        const src = findEntitySource(sp, kind, id);
        const current = readEntitySource(sp, src);
        await assertVersion(body.version as string, current.version, () => current);
        const abs = src.sf.getFilePath();
        const paths = sp.root.paths;
        const own = (f: string) => f === abs || f === paths.register || f === paths.worldState;

        const refs: TReferenceDto[] = [...findImportReferences(sp, abs, own)];
        if (kind === 'characters') {
            // a chapter that still has a `<character>.passages/` folder
            for (const ch of chapterIds(sp)) {
                const files = chapterCharacterFiles(sp, ch).get(id) ?? [];
                refs.push(...files.map((sf) => referenceAt(sp, sf, 1)));
            }
        }
        if (refs.length > 0)
            throw HttpError.referenced(dedupe(refs), `${cap(kind.slice(0, -1))} "${id}" is still referenced`);

        const s = sp.session();
        s.apply(() => {
            s.delete(abs);
            registerRemove(s, kind, id);
            worldStateRemove(s, kind, id);
        });
        if (kind === 'locations') s.after((tx) => removeLocationPolygon(tx, id));
        // a character's / npc's portrait goes with it (`project/images.ts`)
        else s.after((tx) => tx.deleteFile(siblingPng(abs)));
        // ids are `keyof TWorldState[...]` / `keyof register.locations`: a literal that still names
        // the entity stops compiling, and is reported as a reference
        await s.commit(bus, () => entityEvent(kind, id, null, 'deleted'), {
            asReferences: (d) => diagnosticsAsReferences(sp, d),
        });
        return { ok: true };
    });
