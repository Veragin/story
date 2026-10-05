import { DeltaTime } from '@story/shared';
import { isCode, type TCode, type TFunctionDto, type TTypeRef, type TValue } from '@story/visualizer-protocol';
import {
    type ArrayLiteralExpression,
    type Expression,
    Node,
    type ObjectLiteralExpression,
    type PropertyAssignment,
    type SourceFile,
    SyntaxKind,
} from 'ts-morph';
import { HttpError } from '../http/HttpError';
import { assertExpression } from './validate';
import {
    applyTextEdits,
    asArray,
    asObject,
    ensureNamedImport,
    formatJsDoc,
    getProp,
    isPlainObject,
    jsDocEdit,
    keyText,
    propertyKey,
    propertyRemovalEdit,
    quote,
    readJsDoc,
    type TTextEdit,
    unwrap,
} from './ast';

export type TSchema =
    | { t: 'value' }
    | { t: 'string' }
    | { t: 'number' }
    | { t: 'boolean' }
    | { t: 'code' }
    | { t: 'fn'; empty: string }
    | { t: 'time' }
    | { t: 'timeRange' }
    | { t: 'delta' }
    | { t: 'linkCost' }
    | { t: 'array'; of: TSchema }
    | { t: 'object'; fields: Record<string, TField> }
    | { t: 'record'; of: TSchema }
    | { t: 'ref'; ref: TRefResolver };

export type TField = {
    schema: TSchema;
    src?: string;
    after?: string[];
};

export type TRefResolver = {
    what: string;
    read(expr: Expression): string | undefined;
    write(id: string, ctx: TWriteCtx): string;
};

export type TWriteCtx = {
    sf: SourceFile;
    file?: string;
    path: string;
};

export const S = {
    value: { t: 'value' } satisfies TSchema,
    string: { t: 'string' } satisfies TSchema,
    number: { t: 'number' } satisfies TSchema,
    boolean: { t: 'boolean' } satisfies TSchema,
    code: { t: 'code' } satisfies TSchema,
    fn: (empty = '() => {}'): TSchema => ({ t: 'fn', empty }),
    time: { t: 'time' } satisfies TSchema,
    timeRange: { t: 'timeRange' } satisfies TSchema,
    delta: { t: 'delta' } satisfies TSchema,
    linkCost: { t: 'linkCost' } satisfies TSchema,
    array: (of: TSchema): TSchema => ({ t: 'array', of }),
    record: (of: TSchema = { t: 'value' }): TSchema => ({ t: 'record', of }),
    object: (fields: Record<string, TSchema | TField>): TSchema => ({
        t: 'object',
        fields: Object.fromEntries(
            Object.entries(fields).map(([k, f]): [string, TField] => [k, 'schema' in f ? f : { schema: f }])
        ),
    }),
    ref: (ref: TRefResolver): TSchema => ({ t: 'ref', ref }),
};

/** How a value of a structure field is read and written. */
export const schemaOf = (ref: TTypeRef): TSchema => {
    switch (ref.t) {
        // an id is stored as its string (`race: 'elf'`), not as an imported object
        case 'ref':
        case 'string':
        case 'literal':
            return S.string;
        case 'number':
            return S.number;
        case 'boolean':
            return S.boolean;
        case 'array':
            return S.array(schemaOf(ref.of));
        case 'object':
            return S.object(Object.fromEntries(ref.fields.map((field) => [field.key, schemaOf(field.type)])));
        case 'function':
            return S.fn();
        case 'code':
            return S.value;
    }
};

const codeOf = (expr: Expression): TCode => ({ code: expr.getText() });

const ownerProp = (expr: Expression): PropertyAssignment | undefined => {
    const parent = expr.getParent();
    return Node.isPropertyAssignment(parent) && parent.getInitializer() === expr ? parent : undefined;
};

const fnOf = (expr: Expression): TFunctionDto => {
    const prop = ownerProp(expr);
    const description = prop ? readJsDoc(prop) : undefined;
    return description === undefined ? codeOf(expr) : { code: expr.getText(), description };
};

const codeText = (value: TCode, ctx: TWriteCtx): string => {
    assertExpression(value.code, ctx.path, ctx.file);
    return value.code;
};

const staticCall = (expr: Expression): { obj: string; method: string; args: Expression[] } | undefined => {
    const e = unwrap(expr);
    if (!Node.isCallExpression(e)) return undefined;
    const callee = e.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return undefined;
    const obj = callee.getExpression();
    if (!Node.isIdentifier(obj)) return undefined;
    return { obj: obj.getText(), method: callee.getName(), args: e.getArguments().filter((a) => Node.isExpression(a)) };
};

const readNumber = (expr: Expression): number | undefined => {
    const e = unwrap(expr);
    if (Node.isNumericLiteral(e)) return e.getLiteralValue();
    if (Node.isPrefixUnaryExpression(e) && e.getOperatorToken() === SyntaxKind.MinusToken) {
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

const readTime = (expr: Expression): string | undefined => {
    const call = staticCall(expr);
    if (call?.obj !== 'Time' || call.method !== 'fromString' || call.args.length !== 1) return undefined;
    return readString(call.args[0]);
};

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

const plainEntries = (obj: ObjectLiteralExpression): [string, Expression][] | undefined => {
    const entries: [string, Expression][] = [];
    for (const p of obj.getProperties()) {
        const key = propertyKey(p);
        if (!Node.isPropertyAssignment(p) || key === undefined) return undefined;
        entries.push([key, p.getInitializerOrThrow()]);
    }
    return entries;
};

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
        const entries = plainEntries(e);
        if (!entries) return codeOf(expr);
        const out: Record<string, TValue> = {};
        for (const [key, init] of entries) out[key] = readFree(init);
        // `{ code: '…' }` would read back as a TCode, so keep it as code to round-trip
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
        if (init === null) return undefined; // shorthand / method: not a plain object
        if (init) out[key] = readValue(init, field.schema);
    }
    return out;
};

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
        case 'fn':
            return fnOf(expr);
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
            const entries = obj && plainEntries(obj);
            if (!entries) return codeOf(expr);
            const out: Record<string, unknown> = {};
            for (const [key, init] of entries) out[key] = readValue(init, schema.of);
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

const isRecordValue = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    }
    if (!isRecordValue(a) || !isRecordValue(b)) return false;
    const ao = a;
    const bo = b;
    const ak = Object.keys(ao).filter((k) => ao[k] !== undefined);
    const bk = Object.keys(bo).filter((k) => bo[k] !== undefined);
    return ak.length === bk.length && ak.every((k) => deepEqual(ao[k], bo[k]));
};

const bad = (ctx: TWriteCtx, expected: string, value: unknown) =>
    HttpError.badRequest(`Field "${ctx.path}" must be ${expected} or { code } (got ${JSON.stringify(value)})`);

const child = (ctx: TWriteCtx, key: string | number): TWriteCtx => ({
    ...ctx,
    path: ctx.path ? `${ctx.path}.${key}` : String(key),
});

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
    const seconds = isRecordValue(value) && Object.keys(value).length === 1 ? value.seconds : undefined;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
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

const asFunction = (value: unknown, empty: string, ctx: TWriteCtx): { code: string; description?: string } => {
    const invalid = () =>
        HttpError.badRequest(`Field "${ctx.path}" must be { code, description? } (got ${JSON.stringify(value)})`);
    if (
        !isRecordValue(value) ||
        !Object.keys(value).every((k) => k === 'code' || k === 'description' || value[k] === undefined)
    ) {
        throw invalid();
    }
    const { code: raw, description } = value;
    if (
        (raw !== undefined && typeof raw !== 'string') ||
        (description !== undefined && typeof description !== 'string')
    ) {
        throw invalid();
    }
    const code = raw === undefined || raw.trim() === '' ? empty : codeText({ code: raw }, ctx);
    return description ? { code, description } : { code };
};

const genObject = (value: unknown, fields: Record<string, TField>, ctx: TWriteCtx): string => {
    if (isCode(value)) return codeText(value, ctx);
    if (!isRecordValue(value)) throw bad(ctx, 'an object', value);
    const parts: string[] = [];
    let described = false;
    for (const [key, v] of Object.entries(value)) {
        if (v === undefined) continue;
        const field = fields[key];
        if (!field) throw HttpError.badRequest(`Unknown field "${child(ctx, key).path}"`);
        const text = `${keyText(field.src ?? key)}: ${genValue(v, field.schema, child(ctx, key))}`;
        const description =
            field.schema.t === 'fn' ? asFunction(v, field.schema.empty, child(ctx, key)).description : undefined;
        described ||= description !== undefined;
        parts.push(description === undefined ? text : `${formatJsDoc(description)}\n${text}`);
    }
    if (parts.length === 0) return '{}';
    // a JSDoc goes on its own line: one property per line (prettier keeps the object expanded)
    return described ? `{\n${parts.join(',\n')},\n}` : `{ ${parts.join(', ')} }`;
};

export const genValue = (value: unknown, schema: TSchema, ctx: TWriteCtx): string => {
    // an `fn` description is a comment before the property, written by `genObject` / `afterAdd`
    if (schema.t === 'fn') return asFunction(value, schema.empty, ctx).code;
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

const replace = (expr: Expression, text: string) => {
    if (expr.getText() !== text) expr.replaceWithText(text);
};

type TPendingDoc = { prop: PropertyAssignment } & ({ description: string | undefined } | { removeProp: true });

const pendingDocs = new WeakMap<SourceFile, TPendingDoc[]>();

const queueDoc = (sf: SourceFile, entry: TPendingDoc) => {
    const list = pendingDocs.get(sf) ?? [];
    list.push(entry);
    pendingDocs.set(sf, list);
};

const afterAdd = (prop: PropertyAssignment, schema: TSchema, v: unknown, ctx: TWriteCtx) => {
    if (schema.t !== 'fn') return;
    const { description } = asFunction(v, schema.empty, ctx);
    if (description !== undefined) queueDoc(ctx.sf, { prop, description });
};

const removeProp = (prop: PropertyAssignment, schema: TSchema | undefined, sf: SourceFile) => {
    if (schema?.t === 'fn') queueDoc(sf, { prop, removeProp: true });
    else prop.remove();
};

const flushJsDocs = (sf: SourceFile) => {
    const list = pendingDocs.get(sf);
    pendingDocs.delete(sf);
    if (!list) return;
    const edits: TTextEdit[] = [];
    for (const entry of list) {
        if (entry.prop.wasForgotten()) continue;
        const edit = 'removeProp' in entry ? propertyRemovalEdit(entry.prop) : jsDocEdit(entry.prop, entry.description);
        if (edit) edits.push(edit);
    }
    applyTextEdits(sf, edits);
};

const updateFn = (expr: Expression, empty: string, next: unknown, ctx: TWriteCtx) => {
    const { code, description } = asFunction(next, empty, ctx);
    const prop = ownerProp(expr);
    if (!prop) throw new Error(`Field "${ctx.path}": a described function must be a property value`);
    replace(expr, code);
    queueDoc(ctx.sf, { prop, description });
};

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
        if (!field) throw HttpError.badRequest(`Unknown field "${child(ctx, key).path}"`);
        const src = field.src ?? key;
        const prop = getProp(obj, src);
        if (prop) {
            updateValue(prop.getInitializerOrThrow(), field.schema, v, child(ctx, key));
        } else {
            const added = obj.addPropertyAssignment({
                name: keyText(src),
                initializer: genValue(v, field.schema, child(ctx, key)),
            });
            afterAdd(added, field.schema, v, child(ctx, key));
        }
    }
    for (const key of removable) {
        if (next[key] !== undefined) continue;
        const field = fieldOf(key);
        const prop = getProp(obj, field?.src ?? key);
        if (prop) removeProp(prop, field?.schema, ctx.sf);
    }
};

export const updateValue = (expr: Expression, schema: TSchema, next: unknown, ctx: TWriteCtx): void => {
    if (schema.t === 'fn') {
        updateFn(expr, schema.empty, next, ctx);
        return;
    }
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
            const obj = asObject(expr);
            if (!obj) break;
            updateObjectLiteral(obj, next, (k) => TIME_RANGE_FIELDS[k], [], ctx);
            return;
        }
        case 'linkCost': {
            const obj = asObject(expr);
            if (!obj || currentIsCode || !isRecordValue(next) || 'seconds' in next) break;
            if (!isRecordValue(current) || 'seconds' in current) break;
            updateObjectLiteral(obj, next, (k) => LINK_COST_FIELDS[k], Object.keys(LINK_COST_FIELDS), ctx);
            return;
        }
        case 'object': {
            const obj = asObject(expr);
            if (!obj || currentIsCode || !isRecordValue(next)) break;
            updateObjectLiteral(obj, next, (k) => schema.fields[k], Object.keys(schema.fields), ctx);
            return;
        }
        case 'record':
        case 'value': {
            if (currentIsCode || !isRecordValue(next) || !isRecordValue(current)) {
                const arr = asArray(expr);
                if (schema.t === 'value' && arr && Array.isArray(next) && Array.isArray(current)) {
                    updateArray(arr, { t: 'value' }, next, current, ctx);
                    return;
                }
                break;
            }
            const obj = asObject(expr);
            if (!obj) break;
            const of: TSchema = schema.t === 'record' ? schema.of : { t: 'value' };
            updateObjectLiteral(obj, next, () => ({ schema: of }), Object.keys(current), ctx);
            return;
        }
        case 'array': {
            const arr = asArray(expr);
            if (!arr || currentIsCode || !Array.isArray(next) || !Array.isArray(current)) break;
            updateArray(arr, schema.of, next, current, ctx);
            return;
        }
        default:
            break;
    }
    replace(expr, genValue(next, schema, ctx));
};

// element-wise, so untouched elements keep their text; a middle insert/remove rewrites the tail
const updateArray = (arr: ArrayLiteralExpression, of: TSchema, next: unknown[], current: unknown[], ctx: TWriteCtx) => {
    const common = Math.min(next.length, current.length);
    for (let i = 0; i < common; i++) {
        updateValue(arr.getElements()[i], of, next[i], child(ctx, i));
    }
    for (let i = current.length - 1; i >= next.length; i--) arr.removeElement(i);
    for (let i = current.length; i < next.length; i++) {
        arr.addElement(genValue(next[i], of, child(ctx, i)));
    }
};

export const applyPartial = (
    obj: ObjectLiteralExpression,
    body: Record<string, unknown>,
    fields: Record<string, TField>,
    sf: SourceFile,
    { skip = [], optional = [] }: { skip?: string[]; optional?: string[] } = {}
) => {
    try {
        applyFields(obj, body, fields, sf, skip, optional);
    } catch (e) {
        pendingDocs.delete(sf); // a refused write applies nothing, not even queued comments
        throw e;
    }
    // last: the comment edits forget the nodes navigated above
    flushJsDocs(sf);
};

const applyFields = (
    obj: ObjectLiteralExpression,
    body: Record<string, unknown>,
    fields: Record<string, TField>,
    sf: SourceFile,
    skip: string[],
    optional: string[]
) => {
    for (const [key, v] of Object.entries(body)) {
        if (key === 'version' || skip.includes(key) || v === undefined) continue;
        const field = fields[key];
        if (!field) throw HttpError.badRequest(`Field "${key}" cannot be edited here`);
        const src = field.src ?? key;
        const prop = getProp(obj, src);
        if (v === null) {
            if (!optional.includes(key)) throw HttpError.badRequest(`Field "${key}" is required and cannot be removed`);
            if (prop) removeProp(prop, field.schema, sf);
            continue;
        }
        const ctx: TWriteCtx = { sf, path: key };
        if (prop) updateValue(prop.getInitializerOrThrow(), field.schema, v, ctx);
        else {
            const added = { name: keyText(src), initializer: genValue(v, field.schema, ctx) };
            const anchor = field.after?.map((k) => getProp(obj, fields[k]?.src ?? k)).find((p) => p !== undefined);
            const addedProp = anchor
                ? obj.insertPropertyAssignment(obj.getProperties().indexOf(anchor) + 1, added)
                : obj.addPropertyAssignment(added);
            afterAdd(addedProp, field.schema, v, ctx);
        }
    }
};

export const readFields = (obj: ObjectLiteralExpression, fields: Record<string, TField>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
        const prop = getProp(obj, field.src ?? key);
        if (prop) out[key] = readValue(prop.getInitializerOrThrow(), field.schema);
    }
    return out;
};
