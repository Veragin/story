import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ts } from 'ts-morph';
import { atomicWrite, readTextOrNull } from '../json/atomicWrite';
import { formatJson } from '../json/format';
import { enginePaths, REPO_ROOT } from '../project/ProjectRoot';

const STORY_TSCONFIG = 'tsconfig.json';

const storyTsconfigValue = (storyDir: string) => {
    const repo = path.relative(storyDir, REPO_ROOT).split(path.sep).join('/') || '.';
    return {
        extends: `${repo}/tsconfig.base.json`,
        compilerOptions: {
            baseUrl: '.',
            paths: {
                '@story/types': ['types/index.ts'],
                '@story/data': ['data/index.ts'],
                '@story/data/*': ['data/*'],
                ...enginePaths((entry) => `${repo}/${entry}`),
            },
        },
        include: ['data', 'types'],
        exclude: ['data/__tests__', 'data/assets', 'node_modules'],
    };
};

export const storyTsconfig = (storyDir: string): Promise<string> => formatJson(storyTsconfigValue(storyDir));

const parseTsconfig = (text: string): unknown => {
    const { config, error } = ts.parseConfigFileTextToJson(STORY_TSCONFIG, text);
    return error === undefined ? config : undefined;
};

// compared as data, so a hand-commented tsconfig with the right paths is left alone
export const migrateStoryTsconfig = async (storyDir: string): Promise<boolean> => {
    const file = path.join(storyDir, STORY_TSCONFIG);
    const text = await readTextOrNull(file);
    // a missing file means a missing story folder, which this must not create
    if (text === null || isDeepStrictEqual(parseTsconfig(text), storyTsconfigValue(storyDir))) return false;
    await atomicWrite(file, await storyTsconfig(storyDir));
    return true;
};
