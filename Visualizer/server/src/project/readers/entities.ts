import type {
    TCharacterDto,
    TFieldDesc,
    TEntityDto,
    TEntityKind,
    TItemDto,
    TItemSource,
    TLocationDto,
    TMaybeCode,
    TNpcDto,
    TValue,
    TValueRecord,
} from '@story/visualizer-protocol';
import { Node, type ObjectLiteralExpression, type PropertyAssignment, type SourceFile } from 'ts-morph';
import { version } from '../../events/version';
import { HttpError } from '../../http/HttpError';
import {
    asObject,
    findExportedObject,
    getPropInit,
    lineOf,
    resolveIdentifierFile,
    stringLiteral,
    stringProp,
    unwrap,
} from '../ast';
import { findObjectEntry, objectEntries, readEntryValues } from '../objectCatalog';
import type { SourceProject } from '../SourceProject';
import { locationRef, registerEntries, type TRegisterEntry } from '../story';
import { readFields, S, schemaOf, type TField } from '../values';
import { readDataType } from './chapters';
import { readType, readTypeNames, type TTypeNames, userFieldsOf } from './structure';

type TSourceKind = Exclude<TEntityKind, 'items'>;

const REGISTER_SECTION: Record<TSourceKind, 'characters' | 'npcs' | 'locations'> = {
    characters: 'characters',
    npcs: 'npcs',
    locations: 'locations',
};

export const DATA_TYPE_SUFFIX: Record<TSourceKind, string> = {
    characters: 'CharacterData',
    npcs: 'NpcData',
    locations: 'LocationData',
};

/** The extendable types behind an entity kind: the entity object's, and its `init`'s. */
export const ENTITY_TYPES: Record<TSourceKind, { entity: string; data?: string }> = {
    characters: { entity: 'TCharacter', data: 'TCharacterData' },
    npcs: { entity: 'TNpc', data: 'TNpcData' },
    locations: { entity: 'TLocation' },
};

const entityUserFields = (sp: SourceProject, kind: TSourceKind, names?: TTypeNames): TFieldDesc[] =>
    userFieldsOf(readType(sp, ENTITY_TYPES[kind].entity, names));

export const entityFields = (sp: SourceProject, kind: TSourceKind): Record<string, TField> => ({
    ...builtInEntityFields(sp, kind),
    ...Object.fromEntries(entityUserFields(sp, kind).map((field) => [field.key, { schema: schemaOf(field.type) }])),
});

export const entityOptional = (sp: SourceProject, kind: TSourceKind): string[] => [
    ...ENTITY_OPTIONAL[kind],
    ...entityUserFields(sp, kind)
        .filter((field) => field.optional)
        .map((field) => field.key),
];

const builtInEntityFields = (sp: SourceProject, kind: TSourceKind): Record<string, TField> => {
    switch (kind) {
        case 'characters':
            return {
                name: { schema: S.string },
                description: { schema: S.string },
                image: { schema: S.string, after: ['description', 'name'] },
                startPassageId: { schema: S.string },
                init: { schema: S.record() },
            };
        case 'npcs':
            return {
                name: { schema: S.string },
                description: { schema: S.string },
                image: { schema: S.string, after: ['description', 'name'] },
                init: { schema: S.record() },
            };
        case 'locations':
            return {
                name: { schema: S.string },
                description: { schema: S.string },
                localCharacters: { schema: S.array(S.object({ name: S.string, description: S.string })) },
                sublocations: { schema: S.array(S.ref(locationRef(sp))) },
                mapId: { schema: S.string },
                init: { schema: S.record() },
            };
    }
};

const ENTITY_OPTIONAL: Record<TSourceKind, string[]> = {
    characters: ['description', 'image', 'startPassageId'],
    npcs: ['image'],
    locations: ['sublocations', 'mapId'],
};

export type TEntitySource = {
    kind: TSourceKind;
    id: string;
    sf: SourceFile;
    exportName: string;
    obj: ObjectLiteralExpression;
    line: number;
};

const entitySourceOf = (kind: TSourceKind, entry: TRegisterEntry): TEntitySource | undefined => {
    if (!entry.file) return undefined;
    const decl = entry.exportName ? entry.file.getVariableDeclaration(entry.exportName) : undefined;
    const obj = asObject(decl?.getInitializer());
    const found = obj && decl ? { decl, obj } : findExportedObject(entry.file, (o) => stringProp(o, 'id') === entry.id);
    if (!found) return undefined;
    return {
        kind,
        id: entry.id,
        sf: entry.file,
        exportName: found.decl.getName(),
        obj: found.obj,
        line: lineOf(found.decl),
    };
};

export const registerEntriesOf = (sp: SourceProject, kind: TSourceKind): TRegisterEntry[] =>
    registerEntries(sp, REGISTER_SECTION[kind]);

export const entitySources = (sp: SourceProject, kind: TSourceKind): TEntitySource[] =>
    registerEntriesOf(sp, kind)
        .map((e) => entitySourceOf(kind, e))
        .filter((e): e is TEntitySource => !!e);

export const findEntitySource = (sp: SourceProject, kind: TSourceKind, id: string): TEntitySource => {
    const found = entitySources(sp, kind).find((e) => e.id === id);
    if (!found) throw HttpError.notFound(`No ${kind.slice(0, -1)} "${id}"`);
    return found;
};

const readUserFields = (fields: Record<string, unknown>, userFields: TFieldDesc[]): TValueRecord => {
    const out: TValueRecord = {};
    for (const { key } of userFields) {
        if (fields[key] !== undefined) out[key] = fields[key] as TValue;
    }
    return out;
};

export const readEntitySource = (sp: SourceProject, src: TEntitySource): TCharacterDto | TNpcDto | TLocationDto => {
    const names = readTypeNames(sp);
    const userFields = entityUserFields(sp, src.kind, names);
    const fields = readFields(src.obj, entityFields(sp, src.kind));
    const base = {
        id: src.id,
        version: version(src.sf.getFullText()),
        file: sp.root.rel(src.sf.getFilePath()),
        line: src.line,
        exportName: src.exportName,
        name: (fields.name ?? src.id) as TMaybeCode<string>,
        init: (fields.init ?? {}) as TMaybeCode<TValueRecord>,
        dataType: readDataType(src.sf, DATA_TYPE_SUFFIX[src.kind], names),
        ...(userFields.length > 0 ? { userFields: readUserFields(fields, userFields) } : {}),
    };
    const opt = <K extends string>(key: K) =>
        (fields[key] !== undefined ? { [key]: fields[key] } : {}) as Partial<Record<K, never>>;
    switch (src.kind) {
        case 'characters':
            return {
                ...base,
                kind: 'characters',
                ...opt('description'),
                ...opt('image'),
                ...opt('startPassageId'),
            };
        case 'npcs':
            return {
                ...base,
                kind: 'npcs',
                description: (fields.description ?? '') as TMaybeCode<string>,
                ...opt('image'),
            };
        case 'locations':
            return {
                ...base,
                kind: 'locations',
                description: (fields.description ?? '') as TMaybeCode<string>,
                localCharacters: (fields.localCharacters ?? []) as TLocationDto['localCharacters'],
                ...opt('sublocations'),
                ...opt('mapId'),
            };
    }
};

export type TItemContainer = { source: TItemSource; sf: SourceFile; obj: ObjectLiteralExpression };

export type TItemSourceNode = TItemContainer & { id: string; prop: PropertyAssignment; item: ObjectLiteralExpression };

const itemInfoFile = (sp: SourceProject) => sp.file(sp.root.abs('data/items/itemInfo.ts'));

export const itemContainers = (sp: SourceProject): TItemContainer[] => {
    const sf = itemInfoFile(sp);
    const decl = sf?.getVariableDeclaration('itemInfo');
    const obj = asObject(decl?.getInitializer());
    if (!sf || !obj) return [];
    const out: TItemContainer[] = [{ source: 'itemInfo', sf, obj }];
    for (const p of obj.getProperties()) {
        if (!Node.isSpreadAssignment(p)) continue;
        const e = unwrap(p.getExpression());
        if (!Node.isIdentifier(e)) continue;
        const target = resolveIdentifierFile(sf, e.getText());
        const inner = target && asObject(target.file.getVariableDeclaration(target.exportName)?.getInitializer());
        if (target && inner) out.push({ source: target.exportName as TItemSource, sf: target.file, obj: inner });
    }
    return out;
};

export const itemNodes = (sp: SourceProject): TItemSourceNode[] =>
    itemContainers(sp).flatMap((c) =>
        objectEntries(c.obj).map(({ id, prop, value }) => ({ ...c, id, prop, item: value }))
    );

export const findItem = (sp: SourceProject, id: string): TItemSourceNode => findObjectEntry(itemNodes(sp), id, 'item');

export const containerForType = (sp: SourceProject, type: string): TItemContainer | undefined => {
    const all = itemContainers(sp);
    const wanted: TItemSource = type === 'food' ? 'foodInfo' : type === 'tool' ? 'toolInfo' : 'itemInfo';
    return all.find((c) => c.source === wanted) ?? all.find((c) => c.source === 'itemInfo');
};

const ITEM_INFO_KEYS = ['name', 'type'];

export const readItemNode = (sp: SourceProject, node: TItemSourceNode): TItemDto => {
    const values = readEntryValues(node.item, (key) => (key === 'name' ? S.string : S.value));
    const typeInit = getPropInit(node.item, 'type');
    return {
        kind: 'items',
        id: node.id,
        source: node.source,
        version: version(node.sf.getFullText()),
        file: sp.root.rel(node.sf.getFilePath()),
        line: lineOf(node.prop),
        exportName: node.source,
        name: (values.name ?? node.id) as TMaybeCode<string>,
        type: stringLiteral(typeInit) ?? typeInit?.getText() ?? '',
        props: Object.fromEntries(Object.entries(values).filter(([key]) => !ITEM_INFO_KEYS.includes(key))),
    };
};

export const readEntity = (sp: SourceProject, kind: TEntityKind, id: string): TEntityDto =>
    kind === 'items' ? readItemNode(sp, findItem(sp, id)) : readEntitySource(sp, findEntitySource(sp, kind, id));

export const listEntities = (sp: SourceProject, kind: TEntityKind): TEntityDto[] =>
    kind === 'items'
        ? itemNodes(sp).map((n) => readItemNode(sp, n))
        : entitySources(sp, kind).map((s) => readEntitySource(sp, s));
