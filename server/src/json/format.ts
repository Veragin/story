import path from 'node:path';
import { format, resolveConfig, type Options } from 'prettier';
import { EXAMPLE_STORY_ROOT } from '../project/ProjectRoot';

export const formatJson = async (value: unknown): Promise<string> => {
    return format(layoutJson(value), { ...(await prettierOptions()), parser: 'json' });
};

const resolveRepoConfig = async (): Promise<Options | null> => {
    try {
        // resolved inside the repo so a temp STORIES_ROOT outside it formats the same way
        return await resolveConfig(path.join(EXAMPLE_STORY_ROOT, 'data', 'store.json'));
    } catch {
        return null;
    }
};

const loadPrettierOptions = async (): Promise<Options> => ({
    tabWidth: 4,
    printWidth: 80,
    endOfLine: 'lf',
    ...(await resolveRepoConfig()),
});

let optionsPromise: Promise<Options> | null = null;

const prettierOptions = (): Promise<Options> => {
    optionsPromise ??= loadPrettierOptions();
    return optionsPromise;
};

const isObject = (v: unknown): v is object => v !== null && typeof v === 'object';

// objects of primitives stay on one line: prettier keeps that only when the input has no newline after `{`
const layoutJson = (value: unknown, indent = ''): string => {
    if (!isObject(value)) return JSON.stringify(value) ?? 'null';
    const inner = indent + '    ';
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        return `[\n${value.map((v) => inner + layoutJson(v, inner)).join(',\n')}\n${indent}]`;
    }
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    if (entries.every(([, v]) => !isObject(v))) {
        return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
    }
    return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${layoutJson(v, inner)}`).join(',\n')}\n${indent}}`;
};

// plain comparison instead of localeCompare: stable across locales
export const sortKeys = <T>(record: Record<string, T>): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const key of Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) out[key] = record[key];
    return out;
};
