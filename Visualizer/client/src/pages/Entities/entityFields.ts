import {
    isCode,
    type TCode,
    type TCreateEntityBody,
    type TEntityDto,
    type TEntityKind,
    type TItemSource,
    type TValue,
} from '@story/visualizer-protocol';

const SERVER_FIELDS = ['version', 'file', 'line', 'exportName', 'kind', 'id'] as const;

const isServerField = (key: string) => (SERVER_FIELDS as readonly string[]).includes(key);

// same rule as the server's ID_RE; case-insensitive uniqueness because npc files are `<Id>.ts`
const ENTITY_ID_RE = /^[a-z][A-Za-z0-9_]*$/;

export const validateEntityId = (id: string, existing: readonly string[] = []): string | null => {
    if (id === '') return 'required';
    if (id.includes('-')) return 'dash';
    if (!ENTITY_ID_RE.test(id)) return 'identifier';
    if (existing.some((e) => e.toLowerCase() === id.toLowerCase())) return 'exists';
    return null;
};

export const ITEM_TYPES = ['value', 'resource', 'weapon', 'food', 'tool'] as const;

export const itemSourceForType = (type: string): TItemSource =>
    type === 'food' ? 'foodInfo' : type === 'tool' ? 'toolInfo' : 'itemInfo';

export const itemTypesForSource = (source: TItemSource): string[] =>
    ITEM_TYPES.filter((t) => itemSourceForType(t) === source);

export const ITEM_TYPE_PROPS: Record<string, { key: string; kind: 'number' | 'string' | 'boolean' }[]> = {
    food: [{ key: 'hungerValue', kind: 'number' }],
    tool: [{ key: 'dmg', kind: 'number' }],
    weapon: [{ key: 'damage', kind: 'number' }],
};

export type TCreateForm = {
    id: string;
    name: string;
    description: string;
    type: string;
    props?: Record<string, number | string | boolean>;
};

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

export const itemCreateProps = (type: string, values: TCreateForm['props'] = {}) =>
    Object.fromEntries(
        (ITEM_TYPE_PROPS[type] ?? []).map((p) => [
            p.key,
            values[p.key] ?? (p.kind === 'number' ? 0 : p.kind === 'boolean' ? false : ''),
        ])
    );

export const createFields = (kind: TEntityKind) => ({
    description:
        kind === 'items' ? ('none' as const) : kind === 'characters' ? ('optional' as const) : ('required' as const),
    type: kind === 'items',
});

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

export const editableOf = (entity: TEntityDto): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entity)) {
        if (!isServerField(key)) out[key] = value;
    }
    return out;
};

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

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

export const toCode = (value: TValue | undefined): TCode => ({ code: valueToSource(value) });

export const fromCode = <T>(value: TCode, fallback: T, accept: (v: unknown) => v is T): T => {
    const literal = parseLiteral(value.code);
    return accept(literal) ? literal : fallback;
};

export const displayName = (value: unknown, fallback: string): string => {
    if (typeof value === 'string') return value || fallback;
    if (isCode(value)) {
        const m = /^_\(\s*(['"`])(.*)\1\s*\)$/.exec(value.code.trim());
        return m ? m[2] : fallback;
    }
    return fallback;
};

export const isString = (v: unknown): v is string => typeof v === 'string';
export const isNumber = (v: unknown): v is number => typeof v === 'number';
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
