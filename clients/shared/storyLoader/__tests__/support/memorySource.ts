import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as core from '@story/core';
import * as shared from '@story/shared';
import { StoryLoader, type TStorySource } from '../../src';

export const HOST_MODULES = { '@story/shared': shared, '@story/core': core };

export type TMemorySource = TStorySource & { files: string[]; fetched: string[] };

export const memorySource = (texts: Readonly<Record<string, string>>): TMemorySource => {
    const fetched: string[] = [];
    return {
        files: Object.keys(texts).sort(),
        fetched,
        fetchText: (file) => {
            fetched.push(file);
            const text = texts[file];
            return text === undefined ? Promise.reject(new Error(`404 ${file}`)) : Promise.resolve(text);
        },
    };
};

export const loaderFor = (source: TMemorySource) =>
    new StoryLoader({ source, files: source.files, hostModules: HOST_MODULES });

const EXAMPLE_ROOT = path.resolve(import.meta.dirname, '../../../../../stories/example');

// what the play manifest lists: every `.ts` of `data/` and `types/`, tests left out
export const exampleStoryTexts = (): Record<string, string> =>
    Object.fromEntries(
        ['data', 'types'].flatMap((root) =>
            readdirSync(path.join(EXAMPLE_ROOT, root), { recursive: true, encoding: 'utf8' })
                .map((rel) => `${root}/${rel.split(path.sep).join('/')}`)
                .filter((file) => file.endsWith('.ts') && !file.includes('__tests__') && !file.includes('node_modules'))
                .map((file) => [file, readFileSync(path.join(EXAMPLE_ROOT, file), 'utf8')])
        )
    );
