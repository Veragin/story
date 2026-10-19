import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXAMPLE_STORY_ROOT } from '../src/project/ProjectRoot';
import { migrateStoryTsconfig, storyTsconfig } from '../src/stories/storyTsconfig';
import { makeTempStoriesRoot, writeStoryFolder } from './helpers/storiesRoot';

const STALE_TSCONFIG = JSON.stringify({
    extends: '../../tsconfig.base.json',
    compilerOptions: {
        baseUrl: '.',
        paths: {
            '@story/core': ['../../core/src/index.ts'],
            '@story/shared': ['../../shared/src/index.ts'],
            '@story/ui': ['../../ui/src/index.ts'],
        },
    },
    include: ['data', 'types'],
});

let root: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
    ({ root, cleanup } = await makeTempStoriesRoot());
});
afterEach(() => cleanup());

describe('story tsconfig migration', () => {
    it('rewrites a stale tsconfig to the generated one, then is a no-op', async () => {
        const dir = await writeStoryFolder(root, 'alpha', { tsconfig: STALE_TSCONFIG });
        const file = path.join(dir, 'tsconfig.json');

        expect(await migrateStoryTsconfig(dir)).toBe(true);
        const generated = await storyTsconfig(dir);
        expect(await readFile(file, 'utf8')).toBe(generated);
        expect(generated).toContain('clients/shared/core/src/index.ts');

        expect(await migrateStoryTsconfig(dir)).toBe(false);
        await writeFile(file, generated);
        expect(await migrateStoryTsconfig(dir)).toBe(false);
    });

    it('leaves the committed example tsconfig alone: its comments do not count as a difference', async () => {
        expect(await migrateStoryTsconfig(EXAMPLE_STORY_ROOT)).toBe(false);
    });

    it('does not create a tsconfig for a folder without one', async () => {
        expect(await migrateStoryTsconfig(path.join(root, 'missing'))).toBe(false);
    });
});
