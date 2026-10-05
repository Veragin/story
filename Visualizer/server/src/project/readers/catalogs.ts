import type { TCatalogEntryDto, TCatalogListDto, TFieldDesc } from '@story/visualizer-protocol';
import type { SourceFile } from 'ts-morph';
import { version } from '../../events/version';
import { HttpError } from '../../http/HttpError';
import { lineOf } from '../ast';
import { findObjectEntry, objectEntries, readEntryValues, type TObjectEntry } from '../objectCatalog';
import type { SourceProject } from '../SourceProject';
import { S, schemaOf, type TField } from '../values';
import { catalogObject, readCatalogs, readType, type TCatalogSource } from './structure';

export type TCatalog = TCatalogSource & { fields: TFieldDesc[] };

export type TCatalogEntrySource = TObjectEntry & { catalog: TCatalog; sf: SourceFile };

export const findCatalog = (sp: SourceProject, name: string): TCatalog => {
    const source = readCatalogs(sp).find((c) => c.name === name);
    if (!source) throw HttpError.notFound(`No catalog "${name}"`);
    return { ...source, fields: readType(sp, source.typeName)?.fields ?? [] };
};

export const catalogFields = (catalog: TCatalog): Record<string, TField> =>
    Object.fromEntries(catalog.fields.map((field) => [field.key, { schema: schemaOf(field.type) }]));

export const catalogEntrySources = (sp: SourceProject, catalog: TCatalog): TCatalogEntrySource[] =>
    objectEntries(catalogObject(sp, catalog.name)).map((entry) => ({ ...entry, catalog, sf: catalog.sf }));

export const findCatalogEntry = (sp: SourceProject, catalog: TCatalog, id: string): TCatalogEntrySource =>
    findObjectEntry(catalogEntrySources(sp, catalog), id, `${catalog.name} entry`);

export const readCatalogEntry = (sp: SourceProject, entry: TCatalogEntrySource): TCatalogEntryDto => {
    const fields = catalogFields(entry.catalog);
    return {
        kind: 'catalog',
        catalog: entry.catalog.name,
        type: entry.catalog.typeName,
        id: entry.id,
        version: version(entry.sf.getFullText()),
        file: entry.catalog.file,
        line: lineOf(entry.prop),
        exportName: entry.catalog.name,
        values: readEntryValues(entry.value, (key) => fields[key]?.schema ?? S.value),
    };
};

export const listCatalog = (sp: SourceProject, name: string): TCatalogListDto => {
    const catalog = findCatalog(sp, name);
    return { catalog: name, entries: catalogEntrySources(sp, catalog).map((entry) => readCatalogEntry(sp, entry)) };
};
