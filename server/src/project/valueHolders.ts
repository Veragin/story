import { keysOf } from '@story/shared';
import { eventIds, type TClearedReferenceDto, type TFieldDesc, type TStructureDto } from '@story/protocol';
import type { ObjectLiteralExpression } from 'ts-morph';
import { asObject, getPropInit } from './ast';
import { objectEntries } from './objectCatalog';
import { readDataType } from './readers/chapters';
import { DATA_TYPE_SUFFIX, ENTITY_TYPES, entitySources, itemNodes } from './readers/entities';
import { catalogObject, ITEM_INFO_TYPE, readCatalogs, type TTypeNames } from './readers/structure';
import type { SourceProject } from './SourceProject';
import { chapterIds, chapterObject } from './story';

export type TResource = TClearedReferenceDto['resource'];

// a nullable field keeps its key, set to `undefined`
export type THolderField = TFieldDesc & { nullable?: boolean };

/** An object literal whose properties are values of `fields`: an instance, or its `init`. */
export type TValueHolder = { resource: TResource; obj: ObjectLiteralExpression; fields: THolderField[]; path: string };

// `TChapter` is an engine type: the reader gives it no fields
const CHAPTER_FIELDS: THolderField[] = [{ key: 'location', type: { t: 'ref', name: 'Location' }, optional: false }];

// `TNpcData.location` is `TLocationId | undefined`
const NULLABLE_FIELDS: Record<string, readonly string[]> = { TNpcData: ['location'] };

const CHAPTER_DATA_SUFFIX = 'ChapterData';

const fieldsOf = (structure: TStructureDto, typeName: string | undefined): THolderField[] => {
    if (!typeName) return [];
    if (typeName === 'TChapter') return CHAPTER_FIELDS;
    const nullable = NULLABLE_FIELDS[typeName] ?? [];
    const declared = structure.types.find((type) => type.name === typeName)?.fields ?? [];
    return declared.map((field) => (nullable.includes(field.key) ? { ...field, nullable: true } : field));
};

const asOptional = (fields: TFieldDesc[] = []): THolderField[] => fields.map((field) => ({ ...field, optional: true }));

export const entityResource = (kind: string, id: string): TResource => ({
    kind: 'entity',
    id: eventIds.entity(kind, id),
});

export const catalogResource = (catalog: string, id: string): TResource => ({
    kind: 'catalog',
    id: eventIds.catalog(catalog, id),
});

const entityHolders = (sp: SourceProject, structure: TStructureDto, names: TTypeNames): TValueHolder[] =>
    keysOf(ENTITY_TYPES).flatMap((kind) =>
        entitySources(sp, kind).flatMap((src) => {
            const resource = entityResource(kind, src.id);
            const types = ENTITY_TYPES[kind];
            const init = asObject(getPropInit(src.obj, 'init'));
            // `init` holds the entity's own data type as `Partial`
            const initFields = [
                ...fieldsOf(structure, types.data),
                ...asOptional(readDataType(src.sf, DATA_TYPE_SUFFIX[kind], names)?.fields),
            ];
            return [
                { resource, obj: src.obj, fields: fieldsOf(structure, types.entity), path: '' },
                ...(init ? [{ resource, obj: init, fields: initFields, path: 'init' }] : []),
            ];
        })
    );

const itemHolders = (sp: SourceProject, structure: TStructureDto): TValueHolder[] =>
    itemNodes(sp).map((node) => ({
        resource: entityResource('items', node.id),
        obj: node.item,
        fields: fieldsOf(structure, ITEM_INFO_TYPE),
        path: '',
    }));

const catalogHolders = (sp: SourceProject, structure: TStructureDto): TValueHolder[] =>
    readCatalogs(sp).flatMap((catalog) =>
        objectEntries(catalogObject(sp, catalog.name)).map((entry) => ({
            resource: catalogResource(catalog.name, entry.id),
            obj: entry.value,
            fields: fieldsOf(structure, catalog.typeName),
            path: '',
        }))
    );

const chapterHolders = (sp: SourceProject, structure: TStructureDto, names: TTypeNames): TValueHolder[] =>
    chapterIds(sp).flatMap((chapterId) => {
        const sf = sp.file(sp.root.paths.chapterFile(chapterId));
        if (!sf) return [];
        const resource: TResource = { kind: 'chapter', id: chapterId };
        const { obj } = chapterObject(sf);
        const init = asObject(getPropInit(obj, 'init'));
        const initFields = readDataType(sf, CHAPTER_DATA_SUFFIX, names)?.fields ?? [];
        return [
            { resource, obj, fields: fieldsOf(structure, 'TChapter'), path: '' },
            ...(init ? [{ resource, obj: init, fields: initFields, path: 'init' }] : []),
        ];
    });

/** Every object literal of the story whose values are typed by the structure. */
export const valueHolders = (sp: SourceProject, structure: TStructureDto, names: TTypeNames): TValueHolder[] => [
    ...entityHolders(sp, structure, names),
    ...itemHolders(sp, structure),
    ...catalogHolders(sp, structure),
    ...chapterHolders(sp, structure, names),
];
