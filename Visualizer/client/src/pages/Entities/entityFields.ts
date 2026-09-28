import {
    isCode,
    type TCode,
    type TCreateEntityBody,
    type TEntityDto,
    type TEntityKind,
    type TItemSource,
    type TValue,
} from '@story/visualizer-protocol';

/**
 * Pure helpers of the Entities page: id rules, the editable-field diff behind partial PUTs, and
 * the literal ⇄ source conversion of the code fields. No React, no MobX, no api.
 */

/** Fields the server derives or owns, never sent back (`TEntityServerFields` + `id`). */
export const SERVER_FIELDS = ['version', 'file', 'line', 'exportName', 'kind', 'id'] as const;

const isServerField = (key: string) => (SERVER_FIELDS as readonly string[]).includes(key);

/* ---------------------------------------------------------------- ids */

/**
 * Entity ids become object keys (`register.characters.thomas`, `itemInfo.bow`), type arguments
 * (`TCharacter<'thomas'>`), file names and the middle part of passage ids
 * (`<chapter>-<character>-<local>`), so they must be plain identifiers without `-` (plan §2).
 * Same rule as the server's `ID_RE` (`Visualizer/server/src/project/story.ts`): a lower-case
 * letter first, then letters, digits and `_`. On top of that the client refuses an id that
 * differs from an existing one only in case (npc files are `<Id>.ts`).
 */
export const ENTITY_ID_RE = /^[a-z][A-Za-z0-9_]*$/;

/** `null` when `id` is a valid new id of `kind`, else the reason (for the create dialog). */
export const validateEntityId = (id: string, existing: readonly string[] = []): string | null => {
    if (id === '') return 'required';
    if (id.includes('-')) return 'dash';
    if (!ENTITY_ID_RE.test(id)) return 'identifier';
    if (existing.some((e) => e.toLowerCase() === id.toLowerCase())) return 'exists';
    return null;
};

/* ---------------------------------------------------------------- items */

/** `TItemType` of `data/items/itemInfo.ts`. */
export const ITEM_TYPES = ['value', 'resource', 'weapon', 'food', 'tool'] as const;

/** Which items file an item of `type` lives in (plan WP7: "choose the file by `type`"). */
export const itemSourceForType = (type: string): TItemSource =>
    type === 'food' ? 'foodInfo' : type === 'tool' ? 'toolInfo' : 'itemInfo';

/** The types an item in `source` may have without moving to another file. */
export const itemTypesForSource = (source: TItemSource): string[] =>
    ITEM_TYPES.filter((t) => itemSourceForType(t) === source);

/** Props every item of a type is expected to have (shown even when missing). */
export const ITEM_TYPE_PROPS: Record<string, { key: string; kind: 'number' | 'string' | 'boolean' }[]> = {
    food: [{ key: 'hungerValue', kind: 'number' }],
    tool: [{ key: 'dmg', kind: 'number' }],
    weapon: [{ key: 'damage', kind: 'number' }],
};

/* ---------------------------------------------------------------- create */

export type TCreateForm = {
    id: string;
    name: string;
    description: string;
    /** items only */
    type: string;
    /** items only: values of `ITEM_TYPE_PROPS[type]` (e.g. `hungerValue`, which `foodInfo` requires) */
    props?: Record<string, number | string | boolean>;
};

/** The `POST /api/entities/:kind` body for the create dialog's fields. */
export const buildCreateBody = (kind: TEntityKind, form: TCreateForm): TCreateEntityBody => {
    const id = form.id.trim();
    const name = form.name.trim() || id;
    switch (kind) {
        case 'characters':
            return (
                form.description.trim() ? { id, name, description: form.description } : { id, name }
            ) as TCreateEntityBody<'characters'>;
        case 'npcs':
        case 'locations':
            return { id, name, description: form.description } as TCreateEntityBody<'npcs'>;
        case 'items':
            return {
                id,
                name,
                type: form.type,
                source: itemSourceForType(form.type),
                props: itemCreateProps(form.type, form.props),
            } as TCreateEntityBody;
    }
};

/** The type's expected props (`ITEM_TYPE_PROPS`) with the dialog's values, defaulting to 0 / '' / false. */
export const itemCreateProps = (type: string, values: TCreateForm['props'] = {}) =>
    Object.fromEntries(
        (ITEM_TYPE_PROPS[type] ?? []).map((p) => [
            p.key,
            values[p.key] ?? (p.kind === 'number' ? 0 : p.kind === 'boolean' ? false : ''),
        ])
    );

/** Whether the create dialog asks for a description, and whether it must be filled. */
export const createFields = (kind: TEntityKind) => ({
    description:
        kind === 'items' ? ('none' as const) : kind === 'characters' ? ('optional' as const) : ('required' as const),
    type: kind === 'items',
});

/* ---------------------------------------------------------------- diff */

/** Deep structural equality of JSON-like values (key order does not matter). */
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
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const k of keys) {
        if (!deepEqual(ao[k], bo[k])) return false;
    }
    return true;
};

/** The editable fields whose value differs between `base` and `draft` — a partial PUT body. */
export const diffEditable = (base: TEntityDto, draft: TEntityDto): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    const b = base as unknown as Record<string, unknown>;
    const d = draft as unknown as Record<string, unknown>;
    for (const key of new Set([...Object.keys(b), ...Object.keys(d)])) {
        if (isServerField(key)) continue;
        if (!deepEqual(b[key], d[key])) out[key] = d[key];
    }
    return out;
};

/** The editable part of an entity (for re-creating one that was deleted on disk). */
export const editableOf = (entity: TEntityDto): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entity)) {
        if (!isServerField(key)) out[key] = value;
    }
    return out;
};

/* ---------------------------------------------------------------- code ⇄ literal */

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

/**
 * A TS source rendering of a free-form value, to show a literal in a code field. `TCode` is its
 * own text. Nested objects and arrays are multi-line with 4-space indent, like the source files.
 */
export const valueToSource = (value: TValue | undefined, indent = ''): string => {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (isCode(value)) return value.code;
    if (typeof value === 'string') return quote(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    const inner = indent + '    ';
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const flat = value.map((v) => valueToSource(v, inner));
        const oneLine = `[${flat.join(', ')}]`;
        if (oneLine.length <= 60 && !oneLine.includes('\n')) return oneLine;
        return `[\n${flat.map((v) => inner + v).join(',\n')},\n${indent}]`;
    }
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const parts = entries.map(([k, v]) => `${IDENT_RE.test(k) ? k : quote(k)}: ${valueToSource(v, inner)}`);
    const oneLine = `{ ${parts.join(', ')} }`;
    if (oneLine.length <= 60 && !oneLine.includes('\n')) return oneLine;
    return `{\n${parts.map((p) => inner + p).join(',\n')},\n${indent}}`;
};

/**
 * The literal a code snippet stands for, when it is a plain string / number / boolean / null
 * literal (`'Forest'`, `10`, `true`). `undefined` when it is anything else.
 */
export const parseLiteral = (source: string): string | number | boolean | null | undefined => {
    const s = source.trim();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    if (/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return Number(s);
    for (const q of ["'", '"', '`']) {
        const m = new RegExp(`^${q}((?:[^${q}\\\\]|\\\\.)*)${q}$`).exec(s);
        if (!m) continue;
        if (q === '`' && m[1].includes('${')) return undefined;
        return m[1].replace(/\\n/g, '\n').replace(/\\(.)/g, '$1');
    }
    return undefined;
};

/** Toggle target of a maybe-code field: literal → `{code}` of its source. */
export const toCode = (value: TValue | undefined): TCode => ({ code: valueToSource(value) });

/** Toggle target of a maybe-code field: `{code}` → its literal, or `fallback` when it is not one. */
export const fromCode = <T>(value: TCode, fallback: T, accept: (v: unknown) => v is T): T => {
    const literal = parseLiteral(value.code);
    return accept(literal) ? literal : fallback;
};

/** Display text of a maybe-code string: the literal, the argument of `_('…')`, or the fallback. */
export const displayName = (value: unknown, fallback: string): string => {
    if (typeof value === 'string') return value || fallback;
    if (isCode(value)) {
        const m = /^_\(\s*(['"`])(.*)\1\s*\)$/.exec(value.code.trim());
        return m ? m[2] : fallback;
    }
    return fallback;
};

/* ---------------------------------------------------------------- guards */

export const isString = (v: unknown): v is string => typeof v === 'string';
export const isNumber = (v: unknown): v is number => typeof v === 'number';
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
