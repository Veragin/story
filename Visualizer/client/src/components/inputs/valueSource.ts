import {
    code,
    isCode,
    isValueRecord,
    type TFunctionDto,
    type TMaybeCode,
    type TValue,
    type TValueRecord,
} from '@story/visualizer-protocol';
import { parseStringLiteral, quoteString } from './codeLiterals';

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const NUMBER_RE = /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const KEY_RE = /^\s*(?:(['"])((?:\\[\s\S]|(?!\1)[^\\])*)\1|([A-Za-z_$][\w$]*)|(\d+(?:\.\d+)?))\s*:/;
const ONE_LINE_MAX = 60;
const CLOSER: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

export const isString = (v: unknown): v is string => typeof v === 'string';
export const isNumber = (v: unknown): v is number => typeof v === 'number';
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
export const isValueArray = (v: TValue): v is TValue[] => Array.isArray(v);
const isMaybeCodeString = (v: TValue | undefined): v is TMaybeCode<string> =>
    v !== undefined && (isString(v) || isCode(v));
export const isTextRecord =
    <const K extends string>(keys: readonly K[]) =>
    (v: TValue): v is Record<K, TMaybeCode<string>> => {
        if (!isValueRecord(v)) return false;
        const record: TValueRecord = v;
        return keys.every((key) => isMaybeCodeString(record[key]));
    };
export const isArrayOf =
    <T extends TValue>(accepts: (value: TValue) => value is T) =>
    (v: TValue): v is T[] =>
        isValueArray(v) && v.every(accepts);

const wrap = (open: string, close: string, parts: string[], indent: string, pad: string) => {
    const oneLine = `${open}${pad}${parts.join(', ')}${pad}${close}`;
    if (oneLine.length <= ONE_LINE_MAX && !oneLine.includes('\n')) return oneLine;
    const inner = `${indent}    `;
    return `${open}\n${parts.map((part) => inner + part).join(',\n')},\n${indent}${close}`;
};

export const valueToSource = (value: TValue | undefined, indent = ''): string => {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (isCode(value)) return value.code;
    if (typeof value === 'string') return quoteString(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    const inner = `${indent}    `;
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        return wrap(
            '[',
            ']',
            value.map((item) => valueToSource(item, inner)),
            indent,
            ''
        );
    }
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const parts = entries.map(
        ([key, item]) => `${IDENT_RE.test(key) ? key : quoteString(key)}: ${valueToSource(item, inner)}`
    );
    return wrap('{', '}', parts, indent, ' ');
};

export type TParseResult = { ok: true; value: TValue } | { ok: false; error: string };

type TScan = { ok: true; end: number } | { ok: false; error: string };

const skipString = (src: string, from: number): TScan => {
    const quote = src[from];
    for (let i = from + 1; i < src.length; i++) {
        if (src[i] === '\\') i++;
        else if (src[i] === quote) return { ok: true, end: i + 1 };
    }
    return { ok: false, error: _('Unterminated string') };
};

const skipComment = (src: string, from: number): number => {
    if (src[from + 1] === '/') {
        const end = src.indexOf('\n', from);
        return end === -1 ? src.length : end;
    }
    const end = src.indexOf('*/', from + 2);
    return end === -1 ? src.length : end + 2;
};

const scanSegment = (src: string, from: number, stopAtComma: boolean): TScan => {
    const open: string[] = [];
    let i = from;
    while (i < src.length) {
        const ch = src[i];
        if (ch === "'" || ch === '"') {
            const scan = skipString(src, i);
            if (!scan.ok) return scan;
            i = scan.end;
            continue;
        }
        if (ch === '`') {
            const scan = skipTemplate(src, i);
            if (!scan.ok) return scan;
            i = scan.end;
            continue;
        }
        if (ch === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
            i = skipComment(src, i);
            continue;
        }
        if (ch in CLOSER) open.push(CLOSER[ch]);
        else if (ch === ')' || ch === ']' || ch === '}') {
            if (open.length === 0) return { ok: true, end: i };
            if (open.pop() !== ch) return { ok: false, error: _('Unexpected %s', ch) };
        } else if (ch === ',' && stopAtComma && open.length === 0) return { ok: true, end: i };
        i++;
    }
    const missing = open.pop();
    return missing ? { ok: false, error: _('Missing %s', missing) } : { ok: true, end: src.length };
};

const skipTemplate = (src: string, from: number): TScan => {
    for (let i = from + 1; i < src.length; i++) {
        if (src[i] === '\\') i++;
        else if (src[i] === '`') return { ok: true, end: i + 1 };
        else if (src[i] === '$' && src[i + 1] === '{') {
            const scan = scanSegment(src, i + 2, false);
            if (!scan.ok) return scan;
            if (src[scan.end] !== '}') return { ok: false, error: _('Missing %s', '}') };
            i = scan.end;
        }
    }
    return { ok: false, error: _('Unterminated string') };
};

const tokenEnd = (text: string, from: number): number => {
    const ch = text[from];
    if (ch !== "'" && ch !== '"' && ch !== '`') return from + 1;
    const scan = ch === '`' ? skipTemplate(text, from) : skipString(text, from);
    return scan.ok ? scan.end : text.length;
};

const stripComments = (text: string): string => {
    let out = '';
    let i = 0;
    while (i < text.length) {
        if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
            out += ' ';
            i = skipComment(text, i);
            continue;
        }
        const end = tokenEnd(text, i);
        out += text.slice(i, end);
        i = end;
    }
    return out;
};

const splitParts = (inner: string): { ok: true; parts: string[] } | { ok: false; error: string } => {
    const parts: string[] = [];
    let pos = 0;
    while (pos <= inner.length) {
        const scan = scanSegment(inner, pos, true);
        if (!scan.ok) return scan;
        if (scan.end < inner.length && inner[scan.end] !== ',')
            return { ok: false, error: _('Unexpected %s', inner[scan.end]) };
        const part = stripComments(inner.slice(pos, scan.end));
        const last = scan.end >= inner.length;
        if (part.trim() === '') {
            if (!last) return { ok: false, error: _('Unexpected %s', ',') };
        } else parts.push(part);
        if (last) break;
        pos = scan.end + 1;
    }
    return { ok: true, parts };
};

const isWrapped = (text: string, open: string) => {
    if (text[0] !== open) return false;
    const scan = scanSegment(text, 1, false);
    return scan.ok && scan.end === text.length - 1;
};

const parseArray = (text: string): TParseResult => {
    const split = splitParts(text.slice(1, -1));
    if (!split.ok) return split;
    const items: TValue[] = [];
    for (const part of split.parts) {
        const item = parseExpression(part);
        if (!item.ok) return item;
        items.push(item.value);
    }
    return { ok: true, value: items };
};

const parseObject = (text: string): TParseResult => {
    const split = splitParts(text.slice(1, -1));
    if (!split.ok) return split;
    const record: TValueRecord = {};
    for (const part of split.parts) {
        const key = KEY_RE.exec(part);
        // shorthand, spread, computed keys and methods are valid but not plain values
        if (!key) return { ok: true, value: code(text) };
        const name = key[3] ?? key[4] ?? parseStringLiteral(`${key[1]}${key[2]}${key[1]}`);
        if (name === undefined) return { ok: false, error: _('Invalid key %s', part.trim()) };
        const item = parseExpression(part.slice(key[0].length));
        if (!item.ok) return { ok: false, error: `${name}: ${item.error}` };
        record[name] = item.value;
    }
    // a literal `{ code: '…' }` would read as code: keep it as its source so it round-trips
    return { ok: true, value: isCode(record) ? code(text) : record };
};

const parseExpression = (source: string): TParseResult => {
    const text = source.trim();
    if (text === '') return { ok: false, error: _('Missing value') };
    if (isWrapped(text, '{')) return parseObject(text);
    if (isWrapped(text, '[')) return parseArray(text);
    if (text === 'true' || text === 'false') return { ok: true, value: text === 'true' };
    if (text === 'null') return { ok: true, value: null };
    if (NUMBER_RE.test(text)) return { ok: true, value: Number(text) };
    const string = parseStringLiteral(text);
    return { ok: true, value: string ?? code(text) };
};

export const parseValueSource = (source: string): TParseResult => {
    const scan = scanSegment(source, 0, false);
    if (!scan.ok) return scan;
    if (scan.end < source.length) return { ok: false, error: _('Unexpected %s', source[scan.end]) };
    return parseExpression(source);
};

export const parsePlainValue = (source: string): TValue | undefined => {
    const parsed = parseValueSource(source);
    return parsed.ok && !isCode(parsed.value) ? parsed.value : undefined;
};

export const parseAs =
    <T extends TValue>(accepts: (value: TValue) => value is T) =>
    (source: string): T | undefined => {
        const value = parsePlainValue(source);
        return value !== undefined && accepts(value) ? value : undefined;
    };

export const parseLiteral = (source: string): string | number | boolean | null | undefined => {
    const value = parsePlainValue(source);
    return value === null || typeof value !== 'object' ? value : undefined;
};

export const toMaybeCode = <T extends TValue>(value: TValue, accepts: (value: TValue) => value is T): TMaybeCode<T> =>
    isCode(value) || accepts(value) ? value : code(valueToSource(value));

const isFunctionRecord = (value: TValue): value is { code: string; description: string } => {
    if (!isValueRecord(value)) return false;
    const record: TValueRecord = value;
    return (
        Object.keys(record).length === 2 && typeof record.code === 'string' && typeof record.description === 'string'
    );
};

export const toFunctionDto = (value: TValue): TFunctionDto =>
    isCode(value) || isFunctionRecord(value) ? value : { code: valueToSource(value) };

export const functionToValue = ({ code: source, description }: TFunctionDto): TValue =>
    description ? { code: source, description } : code(source);
