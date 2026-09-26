import type {
    TCharacterDto,
    TEntityDto,
    TEntityKind,
    TItemDto,
    TItemSource,
    TLocationDto,
    TMaybeCode,
    TNpcDto,
    TValueRecord,
} from '@story/visualizer-protocol';
import { Node, type ObjectLiteralExpression, type PropertyAssignment, type SourceFile } from 'ts-morph';
import { version } from '../../events/version';
import { HttpError } from '../../http/HttpError';
import {
    asObject,
    findExportedObject,
    lineOf,
    propertyKey,
    resolveIdentifierFile,
    stringLiteral,
    stringProp,
    unwrap,
} from '../ast';
import type { SourceProject } from '../SourceProject';
import { locationRef, registerEntries, type TRegisterEntry } from '../story';
import { readFields, readValue, S, type TField } from '../values';
import { readDataType } from './chapters';

type TSourceKind = Exclude<TEntityKind, 'items'>;

export const REGISTER_SECTION: Record<TSourceKind, 'characters' | 'npcs' | 'locations'> = {
    characters: 'characters',
    npcs: 'npcs',
    locations: 'locations',
};

export const DATA_TYPE_SUFFIX: Record<TSourceKind, string> = {
    characters: 'CharacterData',
    npcs: 'NpcData',
    locations: 'LocationData',
};

/** Editable fields per entity kind (`types/TCharacter.ts`, `types/TLocation.ts`). */
export const entityFields = (sp: SourceProject, kind: TSourceKind): Record<string, TField> => {
    switch (kind) {
        case 'characters':
            return {
                name: { schema: S.string },
                description: { schema: S.string },
                startPassageId: { schema: S.string },
                init: { schema: S.record() },
            };
        case 'npcs':
            return {
                name: { schema: S.string },
                description: { schema: S.string },
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

export const ENTITY_OPTIONAL: Record<TSourceKind, string[]> = {
    characters: ['description', 'startPassageId'],
    npcs: [],
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
    registerEntries(sp, REGISTER_SECTION[kind])
        .map((e) => entitySourceOf(kind, e))
        .filter((e): e is TEntitySource => !!e);

export const findEntitySource = (sp: SourceProject, kind: TSourceKind, id: string): TEntitySource => {
    const found = entitySources(sp, kind).find((e) => e.id === id);
    if (!found) throw HttpError.notFound(`No ${kind.slice(0, -1)} "${id}"`);
    return found;
};

export const readEntitySource = (sp: SourceProject, src: TEntitySource): TCharacterDto | TNpcDto | TLocationDto => {
    const fields = readFields(src.obj, entityFields(sp, src.kind));
    const base = {
        id: src.id,
        version: version(src.sf.getFullText()),
        file: sp.root.rel(src.sf.getFilePath()),
        line: src.line,
        exportName: src.exportName,
        name: (fields.name ?? src.id) as TMaybeCode<string>,
        init: (fields.init ?? {}) as TMaybeCode<TValueRecord>,
        dataType: readDataType(src.sf, DATA_TYPE_SUFFIX[src.kind]),
    };
    const opt = <K extends string>(key: K) =>
        (fields[key] !== undefined ? { [key]: fields[key] } : {}) as Partial<Record<K, never>>;
    switch (src.kind) {
        case 'characters':
            return { ...base, kind: 'characters', ...opt('description'), ...opt('startPassageId') };
        case 'npcs':
            return { ...base, kind: 'npcs', description: (fields.description ?? '') as TMaybeCode<string> };
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

// ---------------------------------------------------------------------------------------------
// Items

export type TItemContainer = { source: TItemSource; sf: SourceFile; obj: ObjectLiteralExpression };

export type TItemSourceNode = TItemContainer & { id: string; prop: PropertyAssignment; item: ObjectLiteralExpression };

const itemInfoFile = (sp: SourceProject) => sp.file(sp.root.abs('data/items/itemInfo.ts'));

/** `itemInfo` and the objects spread into it (`...foodInfo`, `...toolInfo`). */
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
        c.obj.getProperties().flatMap((p) => {
            if (!Node.isPropertyAssignment(p)) return [];
            const id = propertyKey(p);
            const item = asObject(p.getInitializer());
            return id && item ? [{ ...c, id, prop: p, item }] : [];
        })
    );

export const findItem = (sp: SourceProject, id: string): TItemSourceNode => {
    const found = itemNodes(sp).find((i) => i.id === id);
    if (!found) throw HttpError.notFound(`No item "${id}"`);
    return found;
};

/** The file a new item of `type` goes into (plan WP7). */
export const containerForType = (sp: SourceProject, type: string): TItemContainer | undefined => {
    const all = itemContainers(sp);
    const wanted: TItemSource = type === 'food' ? 'foodInfo' : type === 'tool' ? 'toolInfo' : 'itemInfo';
    return all.find((c) => c.source === wanted) ?? all.find((c) => c.source === 'itemInfo');
};

export const readItemNode = (sp: SourceProject, node: TItemSourceNode): TItemDto => {
    const props: TValueRecord = {};
    let name: TMaybeCode<string> = node.id;
    let type = '';
    for (const p of node.item.getProperties()) {
        const key = propertyKey(p);
        if (!key) continue;
        const init = Node.isPropertyAssignment(p) ? p.getInitializerOrThrow() : undefined;
        if (key === 'name' && init) name = readValue(init, S.string) as TMaybeCode<string>;
        else if (key === 'type' && init) type = stringLiteral(init) ?? init.getText();
        else if (init) props[key] = readValue(init, S.value) as TValueRecord[string];
        else props[key] = { code: p.getText() };
    }
    return {
        kind: 'items',
        id: node.id,
        source: node.source,
        version: version(node.sf.getFullText()),
        file: sp.root.rel(node.sf.getFilePath()),
        line: lineOf(node.prop),
        exportName: node.source,
        name,
        type,
        props,
    };
};

// ---------------------------------------------------------------------------------------------

export const readEntity = (sp: SourceProject, kind: TEntityKind, id: string): TEntityDto =>
    kind === 'items' ? readItemNode(sp, findItem(sp, id)) : readEntitySource(sp, findEntitySource(sp, kind, id));

export const listEntities = (sp: SourceProject, kind: TEntityKind): TEntityDto[] =>
    kind === 'items'
        ? itemNodes(sp).map((n) => readItemNode(sp, n))
        : entitySources(sp, kind).map((s) => readEntitySource(sp, s));
