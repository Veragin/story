import path from 'node:path';
import { format, resolveConfig, type Options } from 'prettier';
import { EXAMPLE_STORY_ROOT } from '../project/ProjectRoot';

/**
 * The JSON text of every store file: diff-friendly and exactly what `yarn pretty` would write, so
 * `prettier --check` stays clean and a hand edit + `yarn pretty` does not reformat the file.
 *
 * Two steps:
 *  1. `layoutJson` lays the value out: an object whose values are all primitives (a point
 *     `{ "x": 1, "y": 2 }`, a palette entry, a `{ "y": 120 }`) goes on one line, every other
 *     object is expanded, one key per line. Prettier keeps an object on one line only when the
 *     input has no newline after `{`, so this choice is what survives step 2.
 *  2. prettier (`parser: 'json'`) with the repo's config (`.prettierrc`: 4 spaces, `printWidth`
 *     80 for JSON), resolved from the example story inside the repo (whose nearest config is
 *     the root `.prettierrc`), so a temp `STORIES_ROOT` outside the repo formats the same way.
 *     It collapses short arrays and breaks lines that are too long.
 */
export const formatJson = async (value: unknown): Promise<string> => {
    return format(layoutJson(value), { ...(await prettierOptions()), parser: 'json' });
};

let optionsPromise: Promise<Options> | null = null;

const prettierOptions = (): Promise<Options> => {
    optionsPromise ??= resolveConfig(path.join(EXAMPLE_STORY_ROOT, 'data', 'store.json'))
        .then((config) => config ?? {})
        .catch(() => ({}))
        .then((config) => ({ tabWidth: 4, printWidth: 80, endOfLine: 'lf' as const, ...config }));
    return optionsPromise;
};

const isPrimitive = (v: unknown) => v === null || typeof v !== 'object';

/** `JSON.stringify(value, null, 4)`, except that objects of primitives stay on one line. */
export const layoutJson = (value: unknown, indent = ''): string => {
    if (isPrimitive(value)) return JSON.stringify(value) ?? 'null';
    const inner = indent + '    ';
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        return `[\n${value.map((v) => inner + layoutJson(v, inner)).join(',\n')}\n${indent}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    if (entries.every(([, v]) => isPrimitive(v))) {
        return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
    }
    return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${layoutJson(v, inner)}`).join(',\n')}\n${indent}}`;
};

/** Object with its keys in sorted order (`localeCompare`-free, so it is stable everywhere). */
export const sortKeys = <T>(record: Record<string, T>): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const key of Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) out[key] = record[key];
    return out;
};
