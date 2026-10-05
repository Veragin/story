import {
    fieldTypeNames,
    isValueRecord,
    refNameOfIdType,
    refTarget,
    structNameError,
    typeDefault,
    typeDefaultContext,
    type TCatalogEntryDto,
    type TChangeEvent,
    type TDiagnosticDto,
    type TFieldDesc,
    type TLiteralDto,
    type TRefTarget,
    type TReferenceDto,
    type TStructTypeDto,
    type TStructureDto,
    type TTypeDefaultContext,
    type TValueRecord,
    type TVersion,
} from '@story/visualizer-protocol';
import {
    clearReferences,
    holderFields,
    migrateValues,
    recordIssues,
    fieldMentions,
    walkRecord,
    type TMockHolder,
} from './mockInstances';
import { clone, fail, invalid, notFound } from './mockHelpers';
import type { TMockSeed } from './mockData';
import type { TVisualizerApi } from './types';

type TMockStructureContext = {
    nextVersion: () => TVersion;
    // `own`: the event echoes the reply's own version, which the client marks as saved
    emit: (event: TChangeEvent, own: boolean) => void;
    reply: <T>(fn: () => T) => Promise<T>;
    checkVersion: (current: { version: TVersion } | undefined, version: TVersion) => void;
    holders: () => TMockHolder[];
    builtInIds: (target: Exclude<TRefTarget, { source: 'catalog' }>) => string[];
};

type TStructureRoutes =
    | 'getStructure'
    | 'createType'
    | 'updateType'
    | 'deleteType'
    | 'createLiteral'
    | 'updateLiteral'
    | 'addLiteralValue'
    | 'deleteLiteral'
    | 'listCatalogEntries'
    | 'createCatalogEntry'
    | 'getCatalogEntry'
    | 'updateCatalogEntry'
    | 'deleteCatalogEntry'
    | 'getCatalogEntryReferences';

type TReferencesPlan = ReturnType<typeof clearReferences>;

export type TMockStructureApi = {
    routes: Pick<TVisualizerApi, TStructureRoutes>;
    load: (seed: Pick<TMockSeed, 'structure' | 'catalogEntries'>) => void;
    referencesTo: (refName: string, id: string, remaining: readonly string[], owner: string) => TReferencesPlan;
    userDefaults: (typeName: string) => TValueRecord;
};

const LITERALS_FILE = 'types/literals.ts';
const CATALOG_NAME_RE = /^[a-z][A-Za-z0-9]*$/;
const ENTRY_ID_RE = /^[a-z][A-Za-z0-9_]*$/;

const diagnostic = (file: string, message: string, field?: string): TDiagnosticDto => ({
    file,
    line: 1,
    column: 1,
    message,
    ...(field ? { field } : {}),
});

const NAME_MESSAGES = {
    required: 'A name is required',
    pattern: 'A name is T and a capital letter, then letters and digits',
    id: 'Names ending in Id are reserved for ids',
    taken: 'The name is taken',
};

const forbidden = (message: string) => fail(403, { error: 'forbidden', message });
const badRequest = (message: string) => fail(400, { error: 'bad_request', message });

export const createMockStructureApi = (ctx: TMockStructureContext): TMockStructureApi => {
    let structure: TStructureDto = { version: '', literals: [], types: [] };
    let catalogs = new Map<string, Map<string, TCatalogEntryDto>>();

    const typeOf = (name: string) => structure.types.find((type) => type.name === name) ?? notFound(`type "${name}"`);
    const literalOf = (name: string) =>
        structure.literals.find((literal) => literal.name === name) ?? notFound(`literal "${name}"`);
    const catalogType = (name: string) =>
        structure.types.find((type) => type.catalog?.name === name) ?? notFound(`catalog "${name}"`);
    const entriesOf = (name: string) => {
        catalogType(name);
        return catalogs.get(name) ?? new Map<string, TCatalogEntryDto>();
    };

    const idsOfRef = (refName: string): string[] => {
        const target = refTarget(refName, structure);
        if (!target) return [];
        if (target.source === 'catalog') return [...(catalogs.get(target.catalog)?.keys() ?? [])];
        return ctx.builtInIds(target);
    };
    const typeContext = (): TTypeDefaultContext => typeDefaultContext(structure, idsOfRef);

    const catalogEvent = (catalog: string, id: string, version: TVersion | null, op: TChangeEvent['op'], own = true) =>
        ctx.emit({ kind: 'catalog', id: `${catalog}/${id}`, version, op }, own);

    const putEntry = (entry: TCatalogEntryDto) => {
        const entries = catalogs.get(entry.catalog) ?? new Map<string, TCatalogEntryDto>();
        catalogs.set(entry.catalog, entries.set(entry.id, entry));
    };

    const catalogHolders = (): TMockHolder[] =>
        [...catalogs.values()].flatMap((entries) =>
            [...entries.values()].map((entry) => ({
                typeName: entry.type,
                file: entry.file,
                resource: { kind: 'catalog' as const, id: `${entry.catalog}/${entry.id}` },
                path: '',
                values: entry.values,
                write: (values: TValueRecord) => {
                    const next = { ...entry, values, version: ctx.nextVersion() };
                    putEntry(next);
                    catalogEvent(entry.catalog, entry.id, next.version, 'updated', false);
                },
            }))
        );

    const holders = () => [...ctx.holders(), ...catalogHolders()];

    const bump = (change: Partial<Pick<TStructureDto, 'literals' | 'types'>>) => {
        structure = { ...structure, ...change, version: ctx.nextVersion() };
        ctx.emit({ kind: 'structure', id: 'structure', version: structure.version, op: 'updated' }, false);
    };

    const putType = (type: TStructTypeDto) =>
        bump({
            types: structure.types.some((t) => t.name === type.name)
                ? structure.types.map((t) => (t.name === type.name ? type : t))
                : [...structure.types, type],
        });

    const putLiteral = (literal: TLiteralDto) =>
        bump({
            literals: structure.literals.some((l) => l.name === literal.name)
                ? structure.literals.map((l) => (l.name === literal.name ? literal : l))
                : [...structure.literals, literal],
        });

    const assertNewName = (name: string, file: string) => {
        const taken = [...structure.types.map((t) => t.name), ...structure.literals.map((l) => l.name)];
        const error = structNameError(name, taken);
        if (error) invalid([diagnostic(file, NAME_MESSAGES[error], 'name')]);
    };

    const assertKnownNames = (fields: readonly TFieldDesc[], file: string) => {
        const known = new Set([...structure.types.map((t) => t.name), ...structure.literals.map((l) => l.name)]);
        const unknown = fields.flatMap((field, i) =>
            fieldTypeNames([field])
                .map((name) => refNameOfIdType(name) ?? name)
                .filter((name) => !known.has(name))
                .map((name) => diagnostic(file, `Cannot find name '${name}'`, `fields.${i}.type`))
        );
        if (unknown.length > 0) invalid(unknown);
    };

    const usagesOf = (name: string, except?: string): TReferenceDto[] =>
        structure.types
            .filter((type) => type.name !== except)
            .flatMap((type) =>
                type.fields
                    .filter((field) => fieldMentions(field, name))
                    .map((field) => ({ file: type.file, line: 1, text: `${type.name}.${field.key}` }))
            );

    const assertValues = (values: readonly string[], file: string) => {
        const problem =
            values.length === 0
                ? 'A literal needs at least one value'
                : values.some((value) => value === '')
                  ? 'A value must not be empty'
                  : new Set(values).size !== values.length
                    ? 'A value is listed twice'
                    : null;
        if (problem) invalid([diagnostic(file, problem, 'values')]);
    };

    const assertEntryValues = (catalog: string, values: unknown): TValueRecord => {
        if (!isValueRecord(values)) return badRequest('Field "values" must be an object');
        const type = catalogType(catalog);
        const unknown = Object.keys(values).find((key) => !type.fields.some((field) => field.key === key));
        if (unknown) badRequest(`values.${unknown}: ${type.name} has no field "${unknown}"`);
        const issues = recordIssues(values, type.fields, typeContext());
        if (issues.length > 0) {
            invalid(
                issues.map((key) =>
                    diagnostic(type.catalog?.file ?? '', `"${key}" does not fit ${type.name}`, `values.${key}`)
                )
            );
        }
        return values;
    };

    const referencesTo: TMockStructureApi['referencesTo'] = (refName, id, remaining, owner) =>
        clearReferences(
            holders().filter((holder) => holder.resource.id !== owner),
            (typeName) => holderFields(structure, typeName),
            { refName, id, fallback: remaining[0] ?? null }
        );

    const renameLiteralValues = (name: string, renames: Record<string, string>) => {
        for (const holder of holders()) {
            const fields = holderFields(structure, holder.typeName);
            const next = walkRecord(holder.values, fields, holder.path, (value, type) =>
                type.t === 'literal' && type.name === name && typeof value === 'string' && value in renames
                    ? renames[value]
                    : value
            );
            if (JSON.stringify(next) !== JSON.stringify(holder.values)) holder.write(next);
        }
    };

    const literalValueUsages = (name: string, removed: readonly string[]): TReferenceDto[] =>
        holders().flatMap((holder) => {
            const found: TReferenceDto[] = [];
            walkRecord(holder.values, holderFields(structure, holder.typeName), holder.path, (value, type, path) => {
                if (
                    type.t === 'literal' &&
                    type.name === name &&
                    typeof value === 'string' &&
                    removed.includes(value)
                ) {
                    found.push({ file: holder.file, line: 1, text: `${path}: '${value}'` });
                }
                return value;
            });
            return found;
        });

    return {
        load: (seed) => {
            structure = { ...clone(seed.structure), version: ctx.nextVersion() };
            catalogs = new Map();
            for (const entry of seed.catalogEntries) putEntry({ ...clone(entry), version: ctx.nextVersion() });
        },
        referencesTo,
        userDefaults: (typeName) => {
            const fields = (structure.types.find((type) => type.name === typeName)?.fields ?? []).filter(
                (field) => !field.locked
            );
            const values = typeDefault({ t: 'object', fields }, typeContext());
            return isValueRecord(values) ? values : {};
        },
        routes: {
            getStructure: () => ctx.reply(() => structure),
            createType: ({ name, fields, catalog }) =>
                ctx.reply(() => {
                    const file = `types/${name}.ts`;
                    assertNewName(name, file);
                    assertKnownNames(fields, file);
                    if (catalog && !CATALOG_NAME_RE.test(catalog.name)) {
                        invalid([diagnostic(file, 'A catalog name is a lower-case identifier', 'catalog.name')]);
                    }
                    if (catalog && catalogs.has(catalog.name)) {
                        fail(409, { error: 'exists', message: `Catalog "${catalog.name}" exists` });
                    }
                    const type: TStructTypeDto = {
                        version: ctx.nextVersion(),
                        file,
                        exportName: name,
                        name,
                        origin: 'story',
                        fields,
                        ...(catalog
                            ? {
                                  catalog: {
                                      name: catalog.name,
                                      file: `data/catalogs/${catalog.name}.ts`,
                                      idType: `${name}Id`,
                                  },
                              }
                            : {}),
                    };
                    if (catalog) catalogs.set(catalog.name, new Map());
                    putType(type);
                    return type;
                }),
            updateType: (name, { version, fields, renames = {}, resetIncompatible = false }) =>
                ctx.reply(() => {
                    const type = typeOf(name);
                    ctx.checkVersion(type, version);
                    if (type.origin === 'engine') forbidden(`${name} is an engine type`);
                    const next = [...type.fields.filter((f) => f.locked), ...fields.filter((f) => !f.locked)];
                    assertKnownNames(next, type.file);
                    const change = { oldFields: type.fields, fields: next, renames, resetIncompatible };
                    const typeCtx = typeContext();
                    const instances = holders().filter((holder) => holder.typeName === name);
                    const migrated = instances.map((holder) => ({ holder, ...migrateValues(holder, change, typeCtx) }));
                    const incompatible = migrated.flatMap(({ holder, incompatible: keys }) =>
                        keys.map((key) =>
                            diagnostic(
                                holder.file,
                                `${holder.resource.id}: "${key}" does not fit the new type of ${name}.${key}`
                            )
                        )
                    );
                    if (incompatible.length > 0) invalid(incompatible);
                    const written = migrated.filter(
                        ({ holder, values }) => JSON.stringify(values) !== JSON.stringify(holder.values)
                    );
                    written.forEach(({ holder, values }) => holder.write(values));
                    const updated: TStructTypeDto = { ...type, fields: next, version: ctx.nextVersion() };
                    putType(updated);
                    return {
                        type: updated,
                        touchedFiles: [...new Set(written.map(({ holder }) => holder.file))].sort(),
                    };
                }),
            deleteType: (name, { version }) =>
                ctx.reply(() => {
                    const type = typeOf(name);
                    ctx.checkVersion(type, version);
                    if (type.origin !== 'story') forbidden(`${name} is not a story type`);
                    const references = usagesOf(name, name);
                    if (references.length > 0) fail(409, { error: 'referenced', references });
                    if (type.catalog) catalogs.delete(type.catalog.name);
                    bump({ types: structure.types.filter((t) => t.name !== name) });
                    return { ok: true as const };
                }),

            createLiteral: ({ name, values, file }) =>
                ctx.reply(() => {
                    const target = file ?? LITERALS_FILE;
                    assertNewName(name, target);
                    assertValues(values, target);
                    const literal: TLiteralDto = {
                        version: ctx.nextVersion(),
                        file: target,
                        exportName: name,
                        name,
                        scope: target === LITERALS_FILE ? 'global' : 'local',
                        values,
                    };
                    putLiteral(literal);
                    return literal;
                }),
            updateLiteral: (name, { version, values, renames = {} }) =>
                ctx.reply(() => {
                    const literal = literalOf(name);
                    ctx.checkVersion(literal, version);
                    assertValues(values, literal.file);
                    const removed = literal.values.filter((value) => !values.includes(value) && !(value in renames));
                    const references = literalValueUsages(name, removed);
                    if (references.length > 0) fail(409, { error: 'referenced', references });
                    renameLiteralValues(name, renames);
                    const next = { ...literal, values, version: ctx.nextVersion() };
                    putLiteral(next);
                    return next;
                }),
            addLiteralValue: (name, { value }) =>
                ctx.reply(() => {
                    const literal = literalOf(name);
                    if (literal.values.includes(value)) {
                        fail(409, { error: 'exists', message: `"${value}" is already in ${name}` });
                    }
                    const next = { ...literal, values: [...literal.values, value], version: ctx.nextVersion() };
                    putLiteral(next);
                    return next;
                }),
            deleteLiteral: (name, { version }) =>
                ctx.reply(() => {
                    const literal = literalOf(name);
                    ctx.checkVersion(literal, version);
                    const references = usagesOf(name);
                    if (references.length > 0) fail(409, { error: 'referenced', references });
                    bump({ literals: structure.literals.filter((l) => l.name !== name) });
                    return { ok: true as const };
                }),

            listCatalogEntries: (name) => ctx.reply(() => ({ catalog: name, entries: [...entriesOf(name).values()] })),
            createCatalogEntry: (name, { id, values }) =>
                ctx.reply(() => {
                    const type = catalogType(name);
                    if (!ENTRY_ID_RE.test(id)) badRequest(`Field "id": "${id}" is not an identifier`);
                    if (entriesOf(name).has(id))
                        fail(409, { error: 'exists', message: `${name} entry "${id}" already exists` });
                    const entry: TCatalogEntryDto = {
                        kind: 'catalog',
                        catalog: name,
                        type: type.name,
                        id,
                        file: type.catalog?.file ?? '',
                        exportName: name,
                        version: ctx.nextVersion(),
                        values: assertEntryValues(name, values),
                    };
                    putEntry(entry);
                    catalogEvent(name, id, entry.version, 'created');
                    return entry;
                }),
            getCatalogEntry: (name, id) =>
                ctx.reply(() => entriesOf(name).get(id) ?? notFound(`${name} entry "${id}"`)),
            updateCatalogEntry: (name, id, { version, values }) =>
                ctx.reply(() => {
                    const entry = entriesOf(name).get(id) ?? notFound(`${name} entry "${id}"`);
                    ctx.checkVersion(entry, version);
                    const next = { ...entry, values: assertEntryValues(name, values), version: ctx.nextVersion() };
                    putEntry(next);
                    catalogEvent(name, id, next.version, 'updated');
                    return next;
                }),
            deleteCatalogEntry: (name, id, { version }) =>
                ctx.reply(() => {
                    const entries = entriesOf(name);
                    const entry = entries.get(id) ?? notFound(`${name} entry "${id}"`);
                    ctx.checkVersion(entry, version);
                    const remaining = [...entries.keys()].filter((key) => key !== id);
                    const plan = referencesTo(entry.type, id, remaining, `${name}/${id}`);
                    if (plan.blocking.length > 0) fail(409, { error: 'referenced', references: plan.blocking });
                    entries.delete(id);
                    catalogEvent(name, id, null, 'deleted');
                    plan.apply();
                    return { ok: true as const, cleared: plan.cleared };
                }),
            getCatalogEntryReferences: (name, id) =>
                ctx.reply(() => {
                    const entries = entriesOf(name);
                    const entry = entries.get(id) ?? notFound(`${name} entry "${id}"`);
                    const remaining = [...entries.keys()].filter((key) => key !== id);
                    const { cleared, blocking } = referencesTo(entry.type, id, remaining, `${name}/${id}`);
                    return { cleared, blocking };
                }),
        },
    };
};
