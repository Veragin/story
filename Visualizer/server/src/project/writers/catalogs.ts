import {
    isValueRecord,
    type TCatalogEntryDto,
    type TClearedReferencesDto,
    type TCreateCatalogEntryBody,
    type TDeleteCatalogEntryBody,
    type TUpdateCatalogEntryBody,
    type TValueRecord,
} from '@story/visualizer-protocol';
import { version } from '../../events/version';
import { HttpError } from '../../http/HttpError';
import { catalogResource, deleteClearingReferences, deleteReferences, type TDeletePlan } from '../clearReferences';
import { addObjectEntry, entryText } from '../objectCatalog';
import {
    catalogEntrySources,
    catalogFields,
    findCatalog,
    findCatalogEntry,
    readCatalogEntry,
    type TCatalog,
} from '../readers/catalogs';
import { catalogObject } from '../readers/structure';
import type { SourceProject } from '../SourceProject';
import { assertId } from '../story';
import { applyPartial, genValue } from '../values';
import { asBody, assertCurrentVersion, type TWriter } from './common';

const catalogEvent = (catalog: string, id: string, v: string | null, op: 'created' | 'updated' | 'deleted') => ({
    ...catalogResource(catalog, id),
    version: v,
    op,
});

// each value is checked against its field when it is written
const parseValues = (value: unknown): TValueRecord => {
    if (!isValueRecord(value)) throw HttpError.badRequest('Field "values" must be an object');
    return value;
};

// a type error inside `races.elf.name` belongs to the form's `values.name`
const entryField =
    (id: string) =>
    (path: string): string | undefined => {
        const [head, ...rest] = path.split('.');
        return head === id && rest.length > 0 ? ['values', ...rest].join('.') : undefined;
    };

const valuesText = (catalog: TCatalog, values: TValueRecord) => {
    const fields = catalogFields(catalog);
    const ctx = { sf: catalog.sf, file: catalog.file };
    return entryText(
        Object.entries(values).map(([key, value]) => {
            const field = fields[key];
            if (!field) throw HttpError.badRequest(`values.${key}: ${catalog.typeName} has no field "${key}"`);
            return [key, genValue(value, field.schema, { ...ctx, path: `values.${key}` })];
        })
    );
};

const commitEntry = async (
    { sp, bus }: TWriter,
    catalog: TCatalog,
    id: string,
    op: 'created' | 'updated',
    edit: () => void
): Promise<TCatalogEntryDto> => {
    const abs = catalog.sf.getFilePath();
    const s = sp.session();
    s.apply(() => {
        s.edit(abs);
        edit();
    });
    await s.commit(bus, (texts) => catalogEvent(catalog.name, id, version(texts.get(abs) ?? sp.text(abs)), op), {
        fields: { file: abs, map: entryField(id) },
    });
    return readCatalogEntry(sp, findCatalogEntry(sp, findCatalog(sp, catalog.name), id));
};

export const createCatalogEntry = ({ sp, bus }: TWriter, name: string, rawBody: TCreateCatalogEntryBody) =>
    sp.run((): Promise<TCatalogEntryDto> => {
        const body = asBody(rawBody);
        const catalog = findCatalog(sp, name);
        const id = assertId(body.id, 'id');
        const values = parseValues(body.values ?? {});
        if (catalogEntrySources(sp, catalog).some((entry) => entry.id === id)) {
            throw HttpError.exists(`${name} entry "${id}" already exists`);
        }
        return commitEntry({ sp, bus }, catalog, id, 'created', () => {
            const obj = catalogObject(sp, catalog.name);
            if (!obj) throw new Error(`${catalog.file}: no \`${catalog.name}\` object`);
            addObjectEntry(obj, id, valuesText(catalog, values));
        });
    });

export const updateCatalogEntry = ({ sp, bus }: TWriter, name: string, id: string, rawBody: TUpdateCatalogEntryBody) =>
    sp.run((): Promise<TCatalogEntryDto> => {
        const body = asBody(rawBody);
        const catalog = findCatalog(sp, name);
        assertCurrentVersion(body, readCatalogEntry(sp, findCatalogEntry(sp, catalog, id)));
        const values = parseValues(body.values);
        const fields = catalogFields(catalog);
        const optional = catalog.fields.filter((field) => field.optional).map((field) => field.key);
        // `values` is the whole entry: a field left out is removed
        const removed = Object.keys(fields).filter((key) => !(key in values));
        const next = { ...Object.fromEntries(removed.map((key) => [key, null])), ...values };
        return commitEntry({ sp, bus }, catalog, id, 'updated', () => {
            applyPartial(findCatalogEntry(sp, catalog, id).value, next, fields, catalog.sf, { optional });
        });
    });

const catalogDeletePlan = (sp: SourceProject, catalog: TCatalog, id: string): TDeletePlan => ({
    refName: catalog.typeName,
    id,
    resource: catalogResource(catalog.name, id),
    remove: (s) => {
        s.edit(catalog.sf.getFilePath());
        findCatalogEntry(sp, catalog, id).prop.remove();
    },
});

export const deleteCatalogEntry = ({ sp, bus }: TWriter, name: string, id: string, rawBody: TDeleteCatalogEntryBody) =>
    sp.run((): Promise<TClearedReferencesDto> => {
        const catalog = findCatalog(sp, name);
        assertCurrentVersion(asBody(rawBody), readCatalogEntry(sp, findCatalogEntry(sp, catalog, id)));
        return deleteClearingReferences(
            { sp, bus },
            catalogDeletePlan(sp, catalog, id),
            catalogEvent(name, id, null, 'deleted'),
            `${name} entry "${id}" is still referenced`
        );
    });

export const catalogEntryDeleteReferences = (sp: SourceProject, name: string, id: string) =>
    sp.run(() => {
        const catalog = findCatalog(sp, name);
        findCatalogEntry(sp, catalog, id);
        return deleteReferences(sp, catalogDeletePlan(sp, catalog, id));
    });
