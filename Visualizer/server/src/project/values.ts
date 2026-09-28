import { DeltaTime } from '@story/shared';
import { isCode, type TCode, type TValue } from '@story/visualizer-protocol';
import { type Expression, Node, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import { HttpError } from '../http/HttpError';
import { assertExpression } from './validate';
import {
    asArray,
    asObject,
    ensureNamedImport,
    getProp,
    isPlainObject,
    keyText,
    propertyKey,
    quote,
    unwrap,
} from './ast';

/**
 * The value engine behind every reader and writer (plan §3 "Code-field convention").
 *
 * A `TSchema` says what a field *is* (a string, a `Time.fromString(…)`, a typed object with known
 * fields, a free-form `init` record, a reference to another declaration, …).
 *
 *  - `readValue(expr, schema)` turns an initializer into the DTO value: the plain value when the
 *    initializer is a literal of the expected shape, `{ code }` (verbatim source) otherwise.
 *  - `updateValue(expr, schema, next, ctx)` edits the initializer in place so it reads as `next`.
 *    It never touches a node whose value did not change, recurses into object/array literals
 *    so a sibling code field (a closure, a comment) survives, and replaces only the smallest node
 *    that changed. `{ code }` is written back verbatim.
 *
 * A typed `object` schema only reads the fields it knows and never removes a property it does
 * not know, so anything the reader did not understand is kept.
 */
export type TSchema =
    | { t: 'value' }
    | { t: 'string' }
    | { t: 'number' }
    | { t: 'boolean' }
    | { t: 'code' }
    | { t: 'time' }
    | { t: 'timeRange' }
    | { t: 'delta' }
    | { t: 'linkCost' }
    | { t: 'array'; of: TSchema }
    | { t: 'object'; fields: Record<string, TField> }
    | { t: 'record'; of: TSchema }
    | { t: 'ref'; ref: TRefResolver };

/** A field of a typed object. `src` is the property name in the source when it differs from the DTO key. */
export type TField = {
    schema: TSchema;
    src?: string;
    /** Where `applyPartial` adds the property when it is missing: after the first of these that exists, else last. */
    after?: string[];
};

/** Resolves an identifier (`villageChapter`) to an id (`village`) and back. */
export type TRefResolver = {
    what: string;
    read(expr: Expression): string | undefined;
    /** Expression text for `id` in `ctx.sf`; adds the import it needs. Throws a 400 for an unknown id. */
    write(id: string, ctx: TWriteCtx): string;
};

export type TWriteCtx = {
    sf: SourceFile;
    /** Project-relative path of `sf`, for diagnostics. */
    file?: string;
    /** Dotted DTO path of the value being written, for error messages. */
    path: string;
};

export const S = {
    value: { t: 'value' } as TSchema,
    string: { t: 'string' } as TSchema,
    number: { t: 'number' } as TSchema,
    boolean: { t: 'boolean' } as TSchema,
    code: { t: 'code' } as TSchema,
    time: { t: 'time' } as TSchema,
    timeRange: { t: 'timeRange' } as TSchema,
    delta: { t: 'delta' } as TSchema,
    linkCost: { t: 'linkCost' } as TSchema,
    array: (of: TSchema): TSchema => ({ t: 'array', of }),
    record: (of: TSchema = { t: 'value' }): TSchema => ({ t: 'record', of }),
    object: (fields: Record<string, TSchema | TField>): TSchema => ({
        t: 'object',
        fields: Object.fromEntries(
            Object.entries(fields).map(([k, f]) => [k, 'schema' in f ? f : { schema: f }])
        ) as Record<string, TField>,
    }),
    ref: (ref: TRefResolver): TSchema => ({ t: 'ref', ref }),
};

const codeOf = (expr: Expression): TCode => ({ code: expr.getText() });

/** The verbatim text of a `{ code }` value, after checking it is exactly one expression. */
const codeText = (value: TCode, ctx: TWriteCtx): string => {
    assertExpression(value.code, ctx.path, ctx.file);
    return value.code;
};

// ---------------------------------------------------------------------------------------------
// Reading

/** `Obj.method(args…)` with an identifier object, e.g. `Time.fromString('…')`. */
const staticCall = (expr: Expression): { obj: string; method: string; args: Expression[] } | undefined => {
    const e = unwrap(expr);
    if (!Node.isCallExpression(e)) return undefined;
    const callee = e.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return undefined;
    const obj = callee.getExpression();
    if (!Node.isIdentifier(obj)) return undefined;
    return { obj: obj.getText(), method: callee.getName(), args: e.getArguments() as Expression[] };
};

const readNumber = (expr: Expression): number | undefined => {
    const e = unwrap(expr);
    if (Node.isNumericLiteral(e)) return e.getLiteralValue();
    if (Node.isPrefixUnaryExpression(e) && e.getOperatorToken() === 40 /* MinusToken */) {
        const operand = e.getOperand();
        if (Node.isNumericLiteral(operand)) return -operand.getLiteralValue();
    }
    return undefined;
};

const readString = (expr: Expression): string | undefined => {
    const e = unwrap(expr);
    if (Node.isStringLiteral(e) || Node.isNoSubstitutionTemplateLiteral(e)) return e.getLiteralText();
    return undefined;
};

const readBoolean = (expr: Expression): boolean | undefined => {
    const e = unwrap(expr);
    if (Node.isTrueLiteral(e)) return true;
    if (Node.isFalseLiteral(e)) return false;
    return undefined;
};

/** `Time.fromString('2.1. 8:00')` → `'2.1. 8:00'`. */
const readTime = (expr: Expression): string | undefined => {
    const call = staticCall(expr);
    if (call?.obj !== 'Time' || call.method !== 'fromString' || call.args.length !== 1) return undefined;
    return readString(call.args[0]);
};

/** Seconds of `DeltaTime.fromMin(10)` & co. with literal arguments. */
const readDelta = (expr: Expression): number | undefined => {
    const call = staticCall(expr);
    if (call?.obj !== 'DeltaTime' || call.args.length !== 1) return undefined;
    const arg = call.args[0];
    switch (call.method) {
        case 'fromS': {
            const n = readNumber(arg);
            return n === undefined ? undefined : new DeltaTime(n).s;
        }
        case 'fromMin': {
            const n = readNumber(arg);
            return n === undefined ? undefined : DeltaTime.fromMin(n).s;
        }
        case 'fromHour': {
            const n = readNumber(arg);
            return n === undefined ? undefined : DeltaTime.fromHour(n).s;
        }
        case 'fromString': {
            const s = readString(arg);
            return s === undefined ? undefined : DeltaTime.fromString(s as never).s;
        }
        default:
            return undefined;
    }
};

/** A free-form value (`init`, item props). */
const readFree = (expr: Expression): TValue => {
    const e = unwrap(expr);
    const s = readString(e);
    if (s !== undefined) return s;
    const n = readNumber(e);
    if (n !== undefined) return n;
    const b = readBoolean(e);
    if (b !== undefined) return b;
    if (Node.isNullLiteral(e)) return null;
    if (Node.isArrayLiteralExpression(e)) {
        const elements = e.getElements();
        if (elements.some((el) => Node.isSpreadElement(el) || Node.isOmittedExpression(el))) return codeOf(expr);
        return elements.map((el) => readFree(el));
    }
    if (Node.isObjectLiteralExpression(e)) {
        if (!isPlainObject(e)) return codeOf(expr);
        const out: Record<string, TValue> = {};
        for (const p of e.getProperties()) {
            out[propertyKey(p)!] = readFree((p as import('ts-morph').PropertyAssignment).getInitializerOrThrow());
        }
        // `{ code: '…' }` would read back as a TCode: keep it as code so it round-trips (common.ts).
        if (isCode(out)) return codeOf(expr);
        return out;
    }
    return codeOf(expr);
};

const readObjectFields = (
    obj: ObjectLiteralExpression,
    fields: Record<string, TField>
): Record<string, unknown> | undefined => {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
        const init = getPropFlexible(obj, field.src ?? key);
        if (init === null) return undefined; // shorthand / method: not a plain object for us
        if (init) out[key] = readValue(init, field.schema);
    }
    return out;
};

/** The initializer of `key`; `null` when the key is present but not as `key: value`. */
const getPropFlexible = (obj: ObjectLiteralExpression, key: string): Expression | undefined | null => {
    for (const p of obj.getProperties()) {
        if (propertyKey(p) !== key) continue;
        if (Node.isPropertyAssignment(p)) return p.getInitializerOrThrow();
        return null;
    }
    for (const p of obj.getProperties()) {
        if (Node.isMethodDeclaration(p) && p.getName() === key) return null;
    }
    return undefined;
};

export const readValue = (expr: Expression, schema: TSchema): unknown => {
    switch (schema.t) {
        case 'value':
            return readFree(expr);
        case 'string':
            return readString(expr) ?? codeOf(expr);
        case 'number':
            return readNumber(expr) ?? codeOf(expr);
        case 'boolean':
            return readBoolean(expr) ?? codeOf(expr);
        case 'code':
            return codeOf(expr);
        case 'time':
            return readTime(expr) ?? codeOf(expr);
        case 'delta': {
            const s = readDelta(expr);
            return s === undefined ? codeOf(expr) : { seconds: s };
        }
        case 'timeRange': {
            const call = staticCall(expr);
            if (call?.obj === 'TimeRange' && call.method === 'fromString' && call.args.length === 2) {
                const start = readString(call.args[0]);
                const end = readString(call.args[1]);
                if (start !== undefined && end !== undefined) return { start, end };
                return codeOf(expr);
            }
            const obj = asObject(expr);
            if (!obj || !isPlainObject(obj) || !getProp(obj, 'start') || !getProp(obj, 'end')) return codeOf(expr);
            return readObjectFields(obj, TIME_RANGE_FIELDS) ?? codeOf(expr);
        }
        case 'linkCost': {
            const s = readDelta(expr);
            if (s !== undefined) return { seconds: s };
            const obj = asObject(expr);
            if (!obj) return codeOf(expr);
            return readObjectFields(obj, LINK_COST_FIELDS) ?? codeOf(expr);
        }
        case 'array': {
            const arr = asArray(expr);
            if (!arr) return codeOf(expr);
            const elements = arr.getElements();
            if (elements.some((el) => Node.isSpreadElement(el) || Node.isOmittedExpression(el))) return codeOf(expr);
            return elements.map((el) => readValue(el, schema.of));
        }
        case 'object': {
            const obj = asObject(expr);
            if (!obj) return codeOf(expr);
            return readObjectFields(obj, schema.fields) ?? codeOf(expr);
        }
        case 'record': {
            const obj = asObject(expr);
            if (!obj || !isPlainObject(obj)) return codeOf(expr);
            const out: Record<string, unknown> = {};
            for (const p of obj.getProperties()) {
                const key = propertyKey(p)!;
                out[key] = readValue((p as import('ts-morph').PropertyAssignment).getInitializerOrThrow(), schema.of);
            }
            if (schema.of.t === 'value' && isCode(out)) return codeOf(expr);
            return out;
        }
        case 'ref': {
            const e = unwrap(expr);
            return (Node.isIdentifier(e) ? schema.ref.read(e) : undefined) ?? codeOf(expr);
        }
    }
};

const TIME_RANGE_FIELDS: Record<string, TField> = {
    start: { schema: { t: 'time' } },
    end: { schema: { t: 'time' } },
};

const LINK_COST_FIELDS: Record<string, TField> = {
    time: { schema: { t: 'delta' } },
    items: { schema: { t: 'value' } },
    tools: { schema: { t: 'value' } },
};

// ---------------------------------------------------------------------------------------------
// Equality

export const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        const bb = b as unknown[];
        return a.length === bb.length && a.every((x, i) => deepEqual(x, bb[i]));
    }
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao).filter((k) => ao[k] !== undefined);
    const bk = Object.keys(bo).filter((k) => bo[k] !== undefined);
    return ak.length === bk.length && ak.every((k) => deepEqual(ao[k], bo[k]));
};

// ---------------------------------------------------------------------------------------------
// Generating source for a DTO value

const bad = (ctx: TWriteCtx, expected: string, value: unknown) =>
    HttpError.badRequest(`Field "${ctx.path}" must be ${expected} or { code } (got ${JSON.stringify(value)})`);

const child = (ctx: TWriteCtx, key: string | number): TWriteCtx => ({
    ...ctx,
    path: ctx.path ? `${ctx.path}.${key}` : String(key),
});

const isRecordValue = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const numberText = (n: number, ctx: TWriteCtx) => {
    if (!Number.isFinite(n)) throw bad(ctx, 'a finite number', n);
    return String(n);
};

const genFree = (value: unknown, ctx: TWriteCtx): string => {
    if (isCode(value)) return codeText(value, ctx);
    if (typeof value === 'string') return quote(value);
    if (typeof value === 'number') return numberText(value, ctx);
    if (typeof value === 'boolean') return String(value);
    if (value === null) return 'null';
    if (Array.isArray(value)) return `[${value.map((v, i) => genFree(v, child(ctx, i))).join(', ')}]`;
    if (isRecordValue(value)) {
        const entries = Object.entries(value).filter(([, v]) => v !== undefined);
        if (entries.length === 0) return '{}';
        return `{ ${entries.map(([k, v]) => `${keyText(k)}: ${genFree(v, child(ctx, k))}`).join(', ')} }`;
    }
    throw bad(ctx, 'a JSON value', value);
};

const genDelta = (value: unknown, ctx: TWriteCtx): string => {
    if (isCode(value)) return codeText(value, ctx);
    const seconds = isRecordValue(value) ? value.seconds : undefined;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || Object.keys(value as object).length !== 1) {
        throw bad(ctx, '{ seconds: number }', value);
    }
    const local = ensureNamedImport(ctx.sf, 'DeltaTime', '@story/shared');
    return seconds % 60 === 0 ? `${local}.fromMin(${seconds / 60})` : `${local}.fromS(${seconds})`;
};

const genTime = (value: unknown, ctx: TWriteCtx): string => {
    if (isCode(value)) return codeText(value, ctx);
    if (typeof value !== 'string') throw bad(ctx, 'a time string', value);
    const local = ensureNamedImport(ctx.sf, 'Time', '@story/shared');
    return `${local}.fromString(${quote(value)})`;
};

const genObject = (value: unknown, fields: Record<string, TField>, ctx: TWriteCtx): string => {
    if (isCode(value)) return codeText(value, ctx);
    if (!isRecordValue(value)) throw bad(ctx, 'an object', value);
    const parts: string[] = [];
    for (const [key, v] of Object.entries(value)) {
        if (v === undefined) continue;
        const field = fields[key];
        if (!field) throw HttpError.badRequest(`Unknown field "${ctx.path ? ctx.path + '.' : ''}${key}"`);
        parts.push(`${keyText(field.src ?? key)}: ${genValue(v, field.schema, child(ctx, key))}`);
    }
    return parts.length === 0 ? '{}' : `{ ${parts.join(', ')} }`;
};

export const genValue = (value: unknown, schema: TSchema, ctx: TWriteCtx): string => {
    if (isCode(value)) return codeText(value, ctx);
    switch (schema.t) {
        case 'value':
            return genFree(value, ctx);
        case 'string':
            if (typeof value !== 'string') throw bad(ctx, 'a string', value);
            return quote(value);
        case 'number':
            if (typeof value !== 'number') throw bad(ctx, 'a number', value);
            return numberText(value, ctx);
        case 'boolean':
            if (typeof value !== 'boolean') throw bad(ctx, 'a boolean', value);
            return String(value);
        case 'code':
            throw bad(ctx, 'code', value);
        case 'time':
            return genTime(value, ctx);
        case 'delta':
            return genDelta(value, ctx);
        case 'timeRange':
            return genObject(value, TIME_RANGE_FIELDS, ctx);
        case 'linkCost':
            if (isRecordValue(value) && 'seconds' in value) return genDelta(value, ctx);
            return genObject(value, LINK_COST_FIELDS, ctx);
        case 'array':
            if (!Array.isArray(value)) throw bad(ctx, 'an array', value);
            return `[${value.map((v, i) => genValue(v, schema.of, child(ctx, i))).join(', ')}]`;
        case 'object':
            return genObject(value, schema.fields, ctx);
        case 'record': {
            if (!isRecordValue(value)) throw bad(ctx, 'an object', value);
            const entries = Object.entries(value).filter(([, v]) => v !== undefined);
            if (entries.length === 0) return '{}';
            return `{ ${entries.map(([k, v]) => `${keyText(k)}: ${genValue(v, schema.of, child(ctx, k))}`).join(', ')} }`;
        }
        case 'ref':
            if (typeof value !== 'string') throw bad(ctx, `a ${schema.ref.what} id`, value);
            return schema.ref.write(value, ctx);
    }
};

// ---------------------------------------------------------------------------------------------
// Updating in place

const replace = (expr: Expression, text: string) => {
    if (expr.getText() !== text) expr.replaceWithText(text);
};

/**
 * Apply `next` to the property set of an object literal: update the keys present in `next`, add
 * the missing ones, and (when `removeMissing` is given) remove the listed keys `next` lacks.
 */
const updateObjectLiteral = (
    obj: ObjectLiteralExpression,
    next: Record<string, unknown>,
    fieldOf: (key: string) => TField | undefined,
    removable: string[],
    ctx: TWriteCtx
) => {
    for (const [key, v] of Object.entries(next)) {
        if (v === undefined) continue;
        const field = fieldOf(key);
        if (!field) throw HttpError.badRequest(`Unknown field "${ctx.path ? ctx.path + '.' : ''}${key}"`);
        const src = field.src ?? key;
        const prop = getProp(obj, src);
        if (prop) {
            updateValue(prop.getInitializerOrThrow(), field.schema, v, child(ctx, key));
        } else {
            obj.addPropertyAssignment({ name: keyText(src), initializer: genValue(v, field.schema, child(ctx, key)) });
        }
    }
    for (const key of removable) {
        if (next[key] !== undefined) continue;
        getProp(obj, fieldOf(key)?.src ?? key)?.remove();
    }
};

export const updateValue = (expr: Expression, schema: TSchema, next: unknown, ctx: TWriteCtx): void => {
    const current = readValue(expr, schema);
    if (deepEqual(current, next)) return;
    if (isCode(next)) {
        replace(expr, codeText(next, ctx));
        return;
    }
    const currentIsCode = isCode(current);

    switch (schema.t) {
        case 'time': {
            const call = staticCall(expr);
            if (!currentIsCode && call && typeof next === 'string') {
                replace(call.args[0], quote(next));
                return;
            }
            break;
        }
        case 'timeRange': {
            if (currentIsCode || !isRecordValue(next)) break;
            const call = staticCall(expr);
            if (call) {
                if (typeof next.start === 'string' && typeof next.end === 'string') {
                    replace(call.args[0], quote(next.start));
                    replace(call.args[1], quote(next.end));
                    return;
                }
                break;
            }
            const obj = asObject(expr)!;
            updateObjectLiteral(obj, next, (k) => TIME_RANGE_FIELDS[k], [], ctx);
            return;
        }
        case 'linkCost': {
            if (currentIsCode || !isRecordValue(next) || 'seconds' in next || 'seconds' in (current as object)) break;
            updateObjectLiteral(asObject(expr)!, next, (k) => LINK_COST_FIELDS[k], Object.keys(LINK_COST_FIELDS), ctx);
            return;
        }
        case 'object': {
            if (currentIsCode || !isRecordValue(next)) break;
            updateObjectLiteral(asObject(expr)!, next, (k) => schema.fields[k], Object.keys(schema.fields), ctx);
            return;
        }
        case 'record':
        case 'value': {
            if (currentIsCode || !isRecordValue(next) || !isRecordValue(current)) {
                if (schema.t === 'value' && Array.isArray(next) && Array.isArray(current)) {
                    updateArray(expr, { t: 'value' }, next, current, ctx);
                    return;
                }
                break;
            }
            const of: TSchema = schema.t === 'record' ? schema.of : { t: 'value' };
            updateObjectLiteral(asObject(expr)!, next, () => ({ schema: of }), Object.keys(current), ctx);
            return;
        }
        case 'array': {
            if (currentIsCode || !Array.isArray(next)) break;
            updateArray(expr, schema.of, next, current as unknown[], ctx);
            return;
        }
        default:
            break;
    }
    replace(expr, genValue(next, schema, ctx));
};

/**
 * Same length: edit element by element (so untouched elements, and untouched fields of the
 * touched ones, keep their text). Otherwise: keep the common prefix, then remove / append the
 * rest. A middle insertion or removal therefore rewrites the elements after it — from the DTO,
 * where code fields are verbatim.
 */
const updateArray = (expr: Expression, of: TSchema, next: unknown[], current: unknown[], ctx: TWriteCtx) => {
    const arr = asArray(expr)!;
    const common = Math.min(next.length, current.length);
    for (let i = 0; i < common; i++) {
        updateValue(arr.getElements()[i] as Expression, of, next[i], child(ctx, i));
    }
    for (let i = current.length - 1; i >= next.length; i--) arr.removeElement(i);
    for (let i = current.length; i < next.length; i++) {
        arr.addElement(genValue(next[i], of, child(ctx, i)));
    }
};

/**
 * Apply a partial PUT body to the top-level object of a resource: each key present in `body`
 * (except `version`) is written through its schema; `null` removes an optional property.
 */
export const applyPartial = (
    obj: ObjectLiteralExpression,
    body: Record<string, unknown>,
    fields: Record<string, TField>,
    sf: SourceFile,
    { skip = [], optional = [] }: { skip?: string[]; optional?: string[] } = {}
) => {
    for (const [key, v] of Object.entries(body)) {
        if (key === 'version' || skip.includes(key) || v === undefined) continue;
        const field = fields[key];
        if (!field) throw HttpError.badRequest(`Field "${key}" cannot be edited here`);
        const src = field.src ?? key;
        const prop = getProp(obj, src);
        if (v === null) {
            if (!optional.includes(key)) throw HttpError.badRequest(`Field "${key}" is required and cannot be removed`);
            prop?.remove();
            continue;
        }
        const ctx: TWriteCtx = { sf, path: key };
        if (prop) updateValue(prop.getInitializerOrThrow(), field.schema, v, ctx);
        else {
            const added = { name: keyText(src), initializer: genValue(v, field.schema, ctx) };
            const anchor = field.after?.map((k) => getProp(obj, fields[k]?.src ?? k)).find((p) => p !== undefined);
            if (anchor) obj.insertPropertyAssignment(obj.getProperties().indexOf(anchor) + 1, added);
            else obj.addPropertyAssignment(added);
        }
    }
};

/** Read the listed fields of a resource object (missing optional fields are left out). */
export const readFields = (obj: ObjectLiteralExpression, fields: Record<string, TField>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
        const prop = getProp(obj, field.src ?? key);
        if (prop) out[key] = readValue(prop.getInitializerOrThrow(), field.schema);
    }
    return out;
};
