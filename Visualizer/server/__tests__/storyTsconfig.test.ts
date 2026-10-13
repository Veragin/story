import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { EXAMPLE_STORY_ROOT, type ProjectRoot } from '../src/project/ProjectRoot';
import { migrateStoryTsconfig, storyTsconfig } from '../src/stories/storyTsconfig';
import { listenLocal, login, makeTempProject, requestJson } from './helpers';

const STALE_TSCONFIG = JSON.stringify({
    extends: '../../tsconfig.base.json',
    compilerOptions: {
        baseUrl: '.',
        paths: {
            '@story/types': ['types/index.ts'],
            '@story/data': ['data/index.ts'],
            '@story/data/*': ['data/*'],
            '@story/core': ['../../core/src/index.ts'],
            '@story/shared': ['../../shared/src/index.ts'],
            '@story/ui': ['../../ui/src/index.ts'],
        },
    },
    include: ['data', 'types'],
});

let project: ProjectRoot;
let storiesRoot: string;
let cleanup: () => Promise<void>;
let tsconfigFile: string;

beforeEach(async () => {
    ({ project, storiesRoot, cleanup } = await makeTempProject());
    tsconfigFile = project.abs('tsconfig.json');
    await writeFile(tsconfigFile, STALE_TSCONFIG);
});
afterEach(() => cleanup());

describe('story tsconfig migration', () => {
    it('rewrites a stale tsconfig to the generated one, then is a no-op', async () => {
        expect(await migrateStoryTsconfig(project.root)).toBe(true);
        const generated = await storyTsconfig(project.root);
        expect(await readFile(tsconfigFile, 'utf8')).toBe(generated);
        expect(generated).toContain('clients/shared/core/src/index.ts');

        expect(await migrateStoryTsconfig(project.root)).toBe(false);
        expect(await readFile(tsconfigFile, 'utf8')).toBe(generated);
    });

    it('leaves the committed example tsconfig alone: its comments do not count as a difference', async () => {
        expect(await migrateStoryTsconfig(EXAMPLE_STORY_ROOT)).toBe(false);
    });

    it('does not create a tsconfig for a folder without one', async () => {
        const missing = path.join(storiesRoot, 'missing');
        expect(await migrateStoryTsconfig(missing)).toBe(false);
    });

    it('runs when a story is loaded', async () => {
        const app = await createApp({ storiesRoot, watch: false });
        try {
            const base = await listenLocal(app);
            const cookie = await login(base);
            const { status } = await requestJson(`${base}/api/stories/example/structure`, 'GET', {
                headers: { cookie },
            });
            expect(status).toBe(200);
            expect(await readFile(tsconfigFile, 'utf8')).toBe(await storyTsconfig(project.root));
        } finally {
            await app.close();
        }
    }, 60_000);
});
