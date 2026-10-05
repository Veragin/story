import {
    fieldTypeNames,
    isCode,
    isValueRecord,
    refNameOfIdType,
    sameTypeRef,
    typeDefault,
    type TClearedReferenceDto,
    type TFieldDesc,
    type TReferenceDto,
    type TResourceKind,
    type TStructureDto,
    type TTypeDefaultContext,
    type TTypeRef,
    type TValue,
    type TValueRecord,
} from '@story/visualizer-protocol';

export type TMockHolder = {
    typeName: string;
    file: string;
    resource: { kind: TResourceKind; id: string };
    // where `values` sits in the resource: `init`, or '' for its own fields
    path: string;
    values: TValueRecord;
    // removed keys of an open record (item props) stay as free props
    openProps?: boolean;
    write: (values: TValueRecord) => void;
};

// an engine type without fields in the structure
const CHAPTER_FIELDS: TFieldDesc[] = [{ key: 'location', type: { t: 'ref', name: 'TLocation' }, optional: false }];

// required, but the engine takes `undefined` there: a cleared value becomes `undefined`
const NULLABLE_FIELDS: Record<string, readonly string[]> = { TNpcData: ['location'] };

export const holderFields = (structure: TStructureDto, typeName: string): TFieldDesc[] =>
    typeName === 'TChapter' ? CHAPTER_FIELDS : (structure.types.find((type) => type.name === typeName)?.fields ?? []);

const fitsType = (value: TValue, type: TTypeRef, ctx: TTypeDefaultContext): boolean => {
    if (isCode(value)) return true;
    switch (type.t) {
        case 'string':
        case 'ref':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number';
        case 'boolean':
            return typeof value === 'boolean';
        case 'literal':
            return typeof value === 'string' && ctx.literalValues(type.name).includes(value);
        case 'array':
            return Array.isArray(value) && value.every((item) => fitsType(item, type.of, ctx));
        case 'object':
            return isValueRecord(value) && recordIssues(value, type.fields, ctx).length === 0;
        case 'function':
        case 'code':
            return true;
    }
};

export const recordIssues = (values: TValueRecord, fields: readonly TFieldDesc[], ctx: TTypeDefaultContext) => [
    ...fields
        .filter((field) => (field.key in values ? !fitsType(values[field.key], field.type, ctx) : !field.optional))
        .map((field) => field.key),
    ...Object.keys(values).filter((key) => !fields.some((field) => field.key === key)),
];

export type TMockTypeChange = {
    oldFields: readonly TFieldDesc[];
    fields: readonly TFieldDesc[];
    renames: Record<string, string>;
    resetIncompatible: boolean;
};

const userFields = (fields: readonly TFieldDesc[]) => fields.filter((field) => !field.locked);

export const migrateValues = (
    holder: TMockHolder,
    change: TMockTypeChange,
    ctx: TTypeDefaultContext
): { values: TValueRecord; incompatible: string[] } => {
    const next: TValueRecord = { ...holder.values };
    const renamed = new Map(Object.entries(change.renames));
    for (const [from, to] of renamed) {
        if (!(from in next)) continue;
        next[to] = next[from];
        delete next[from];
    }
    const sourceKey = (key: string) => [...renamed].find(([, to]) => to === key)?.[0] ?? key;
    const kept = userFields(change.fields);
    if (!holder.openProps) {
        for (const old of userFields(change.oldFields)) {
            if (!kept.some((field) => sourceKey(field.key) === old.key)) delete next[old.key];
        }
    }
    const incompatible: string[] = [];
    for (const field of kept) {
        const old = change.oldFields.find((f) => f.key === sourceKey(field.key));
        if (!(field.key in next)) {
            if (!field.optional) next[field.key] = typeDefault(field.type, ctx);
            continue;
        }
        if (!old || sameTypeRef(old.type, field.type) || fitsType(next[field.key], field.type, ctx)) continue;
        if (!change.resetIncompatible) incompatible.push(field.key);
        else if (field.optional) delete next[field.key];
        else next[field.key] = typeDefault(field.type, ctx);
    }
    return { values: next, incompatible };
};

type TVisit = (value: TValue, type: TTypeRef, path: string) => TValue;

const walkValue = (value: TValue, type: TTypeRef, path: string, visit: TVisit): TValue => {
    if (type.t === 'array' && Array.isArray(value)) {
        return value.map((item, i) => walkValue(item, type.of, `${path}.${i}`, visit));
    }
    if (type.t === 'object' && isValueRecord(value)) return walkRecord(value, type.fields, path, visit);
    return visit(value, type, path);
};

export const walkRecord = (
    values: TValueRecord,
    fields: readonly TFieldDesc[],
    path: string,
    visit: TVisit
): TValueRecord =>
    Object.fromEntries(
        Object.entries(values).map(([key, value]) => {
            const field = fields.find((f) => f.key === key);
            const at = path ? `${path}.${key}` : key;
            return [key, field ? walkValue(value, field.type, at, visit) : value];
        })
    );

export const fieldMentions = (field: TFieldDesc, name: string): boolean =>
    fieldTypeNames([field]).some((typeName) => typeName === name || refNameOfIdType(typeName) === name) ||
    (field.type.t === 'code' && new RegExp(`\\b${name}(Id)?\\b`).test(field.type.code));

export type TRefTargetValue = {
    refName: string;
    id: string;
    fallback: string | null;
};

export type TClearResult = { cleared: TClearedReferenceDto[]; blocking: TReferenceDto[] };

const REMOVE = Symbol('remove');

type TClearContext = TRefTargetValue & {
    holder: TMockHolder;
    result: TClearResult;
};

const isNullable = (ctx: TClearContext, path: string, key: string) =>
    path === ctx.holder.path && (NULLABLE_FIELDS[ctx.holder.typeName] ?? []).includes(key);

const isTarget = (value: TValue, type: TTypeRef, ctx: TClearContext) =>
    type.t === 'ref' && type.name === ctx.refName && value === ctx.id;

const note = (ctx: TClearContext, path: string, change: TClearedReferenceDto['change']) =>
    ctx.result.cleared.push({
        file: ctx.holder.file,
        line: 1,
        text: `${path}: '${ctx.id}'`,
        resource: ctx.holder.resource,
        path,
        change,
    });

const clearValue = (
    value: TValue,
    type: TTypeRef,
    path: string,
    removable: boolean,
    ctx: TClearContext
): TValue | typeof REMOVE => {
    if (isTarget(value, type, ctx)) {
        if (removable) {
            note(ctx, path, { op: 'removed' });
            return REMOVE;
        }
        if (ctx.fallback !== null) {
            note(ctx, path, { op: 'set', value: ctx.fallback });
            return ctx.fallback;
        }
        ctx.result.blocking.push({ file: ctx.holder.file, line: 1, text: `${path}: '${ctx.id}' (required)` });
        return value;
    }
    if (type.t === 'array' && Array.isArray(value)) {
        const items = type.of;
        return value.flatMap((item, i) => {
            const at = `${path}.${i}`;
            // an element whose required field points at the id goes as a whole (`{ id: 'axe' }`)
            const record: TValueRecord | null = isValueRecord(item) ? item : null;
            const pointsAtTarget =
                items.t === 'object' &&
                record !== null &&
                items.fields.some((field) => !field.optional && isTarget(record[field.key], field.type, ctx));
            if (pointsAtTarget) {
                note(ctx, at, { op: 'removed' });
                return [];
            }
            const next = clearValue(item, items, at, true, ctx);
            return next === REMOVE ? [] : [next];
        });
    }
    if (type.t === 'object' && isValueRecord(value)) return clearRecord(value, type.fields, path, ctx);
    return value;
};

const clearRecord = (
    values: TValueRecord,
    fields: readonly TFieldDesc[],
    path: string,
    ctx: TClearContext
): TValueRecord => {
    const next: TValueRecord = {};
    for (const [key, value] of Object.entries(values)) {
        const field = fields.find((f) => f.key === key);
        const at = path ? `${path}.${key}` : key;
        if (field && isNullable(ctx, path, key) && isTarget(value, field.type, ctx)) {
            note(ctx, at, { op: 'set', value: null });
            continue;
        }
        const cleared = field ? clearValue(value, field.type, at, field.optional, ctx) : value;
        if (cleared !== REMOVE) next[key] = cleared;
    }
    return next;
};

export const clearReferences = (
    holders: readonly TMockHolder[],
    fieldsOf: (typeName: string) => readonly TFieldDesc[],
    target: TRefTargetValue
): TClearResult & { apply: () => void } => {
    const result: TClearResult = { cleared: [], blocking: [] };
    const writes = holders.flatMap((holder) => {
        const before = result.cleared.length;
        const next = clearRecord(holder.values, fieldsOf(holder.typeName), holder.path, {
            ...target,
            holder,
            result,
        });
        return result.cleared.length > before ? [() => holder.write(next)] : [];
    });
    return { ...result, apply: () => writes.forEach((write) => write()) };
};
