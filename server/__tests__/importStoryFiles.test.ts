import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyPassword } from '../src/auth/password';
import { EXAMPLE_STORY_ROOT } from '../src/project/ProjectRoot';
import { importStoryFiles } from '../src/stories/importStoryFiles';
import { STORY_FILE } from '../src/stories/storyFile';
import { readStorySeed, type TStorySeed } from '../src/stories/storySeed';
import { StoryRepository } from '../src/database/repositories/StoryRepository';
import { storyTsconfig } from '../src/stories/storyTsconfig';
import { setupTestDatabase } from './helpers/database';
import { EXAMPLE_PASSWORD } from './helpers/http';
import { copyExampleStory, makeTempStoriesRoot, storyFixture, writeStoryFolder } from './helpers/storiesRoot';

const STALE_TSCONFIG = JSON.stringify({ extends: '../../tsconfig.base.json', include: ['data', 'types'] });

const dataSource = setupTestDatabase();
const stories = () => new StoryRepository(dataSource);

let root: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
    ({ root, cleanup } = await makeTempStoriesRoot());
});
afterEach(() => cleanup());

const fileExists = async (file: string) => (await readFile(file).catch(() => null)) !== null;

describe('importStoryFiles', () => {
    it('imports a valid story.json, rewrites the tsconfig and deletes story.json', async () => {
        const dir = await writeStoryFolder(root, 'alpha', {
            storyJson: JSON.stringify(storyFixture()),
            tsconfig: STALE_TSCONFIG,
        });

        const report = await importStoryFiles(root, stories());

        expect(report).toEqual({
            imported: [{ id: 'alpha', result: 'inserted' }],
            skipped: [],
            tsconfigRewritten: ['alpha'],
            seeded: [],
        });
        expect(await stories().readVersioned('alpha')).toEqual({ file: storyFixture(), version: '1' });
        expect(await fileExists(path.join(dir, STORY_FILE))).toBe(false);
        expect(await readFile(path.join(dir, 'tsconfig.json'), 'utf8')).toBe(await storyTsconfig(dir));
    });

    it('reads an optional email: a legacy story.json has none', async () => {
        const legacy: Record<string, unknown> = { ...storyFixture() };
        delete legacy.email;
        await writeStoryFolder(root, 'alpha', { storyJson: JSON.stringify(legacy) });
        await writeStoryFolder(root, 'beta', { storyJson: JSON.stringify(storyFixture({ email: 'me@example.com' })) });
        await importStoryFiles(root, stories());
        expect((await stories().read('alpha'))?.email).toBe('');
        expect((await stories().read('beta'))?.email).toBe('me@example.com');
    });

    it('skips an invalid story.json with a reason and keeps the file', async () => {
        await writeStoryFolder(root, 'alpha', { storyJson: JSON.stringify(storyFixture()) });
        const broken = await writeStoryFolder(root, 'broken', {
            storyJson: JSON.stringify({ ...storyFixture(), public: 'yes' }),
            tsconfig: STALE_TSCONFIG,
        });
        await writeStoryFolder(root, 'garbled', { storyJson: '{ not json' });

        const report = await importStoryFiles(root, stories());

        expect(report.imported).toEqual([{ id: 'alpha', result: 'inserted' }]);
        expect(report.skipped).toEqual([
            { id: 'broken', reason: 'story.json: "public" must be a boolean' },
            { id: 'garbled', reason: expect.any(String) },
        ]);
        expect(await stories().exists('broken')).toBe(false);
        expect(await fileExists(path.join(broken, STORY_FILE))).toBe(true);
        expect(await readFile(path.join(broken, 'tsconfig.json'), 'utf8')).toBe(STALE_TSCONFIG);
    });

    it('reports a folder with neither story.json nor a row, and ignores non-story names', async () => {
        await writeStoryFolder(root, 'orphan');
        await writeStoryFolder(root, '.import-temp', { storyJson: JSON.stringify(storyFixture()) });
        await writeStoryFolder(root, 'Not_An_Id', { storyJson: JSON.stringify(storyFixture()) });
        await writeFile(path.join(root, 'loose-file'), 'x');

        const report = await importStoryFiles(root, stories());

        expect(report).toEqual({
            imported: [],
            skipped: [{ id: 'orphan', reason: 'no story.json and no database row' }],
            tsconfigRewritten: [],
            seeded: [],
        });
        expect(await stories().count()).toBe(0);
    });

    it('is idempotent: a rerun changes nothing', async () => {
        await writeStoryFolder(root, 'alpha', { storyJson: JSON.stringify(storyFixture()), tsconfig: STALE_TSCONFIG });
        await importStoryFiles(root, stories());

        expect(await importStoryFiles(root, stories())).toEqual({
            imported: [],
            skipped: [],
            tsconfigRewritten: [],
            seeded: [],
        });
        expect(await stories().readVersioned('alpha')).toEqual({ file: storyFixture(), version: '1' });
    });

    it('reruns cleanly when a story.json survived a previous run', async () => {
        const json = JSON.stringify(storyFixture());
        const dir = await writeStoryFolder(root, 'alpha', { storyJson: json });
        await importStoryFiles(root, stories());
        await writeFile(path.join(dir, STORY_FILE), json);

        const report = await importStoryFiles(root, stories());

        expect(report.imported).toEqual([{ id: 'alpha', result: 'unchanged' }]);
        expect((await stories().readVersioned('alpha'))?.version).toBe('1');
        expect(await fileExists(path.join(dir, STORY_FILE))).toBe(false);
    });

    it('still rewrites a stale tsconfig of an already imported story', async () => {
        const dir = await writeStoryFolder(root, 'alpha', { storyJson: JSON.stringify(storyFixture()) });
        await importStoryFiles(root, stories());
        await writeFile(path.join(dir, 'tsconfig.json'), STALE_TSCONFIG);

        const report = await importStoryFiles(root, stories());

        expect(report.tsconfigRewritten).toEqual(['alpha']);
        expect(await readFile(path.join(dir, 'tsconfig.json'), 'utf8')).toBe(await storyTsconfig(dir));
    });

    describe('seed', () => {
        let seedRoot: string;
        let seed: TStorySeed;
        let cleanupSeed: () => Promise<void>;

        beforeEach(async () => {
            ({ root: seedRoot, cleanup: cleanupSeed } = await makeTempStoriesRoot());
            const dir = await writeStoryFolder(seedRoot, 'example', { tsconfig: STALE_TSCONFIG });
            seed = { dir, file: storyFixture({ name: 'Example', public: true }) };
        });
        afterEach(() => cleanupSeed());

        it('copies the seed folder into an empty database and inserts its row, leaving the seed alone', async () => {
            const target = path.join(root, 'missing-root');

            const report = await importStoryFiles(target, stories(), { seeds: [seed] });

            expect(report).toEqual({ imported: [], skipped: [], tsconfigRewritten: [], seeded: ['example'] });
            expect(await stories().read('example')).toEqual(seed.file);
            const copied = path.join(target, 'example');
            expect(await readFile(path.join(copied, 'tsconfig.json'), 'utf8')).toBe(await storyTsconfig(copied));
            expect(await readFile(path.join(seed.dir, 'tsconfig.json'), 'utf8')).toBe(STALE_TSCONFIG);

            expect((await importStoryFiles(target, stories(), { seeds: [seed] })).seeded).toEqual([]);
        });

        it('gives an existing seed folder without a row its row, even when other stories exist', async () => {
            await writeStoryFolder(root, 'alpha', { storyJson: JSON.stringify(storyFixture()) });
            await writeStoryFolder(root, 'example');

            const report = await importStoryFiles(root, stories(), { seeds: [seed] });

            expect(report).toMatchObject({ imported: [{ id: 'alpha', result: 'inserted' }], skipped: [] });
            expect(report.seeded).toEqual(['example']);
            expect((await stories().read('example'))?.name).toBe('Example');
        });

        it('does not copy the seed folder when the database already holds a story', async () => {
            await writeStoryFolder(root, 'alpha', { storyJson: JSON.stringify(storyFixture()) });

            const report = await importStoryFiles(root, stories(), { seeds: [seed] });

            expect(report.seeded).toEqual([]);
            expect(await fileExists(path.join(root, 'example'))).toBe(false);
        });

        it('lets a legacy story.json in the seed folder win over the seed metadata', async () => {
            await writeStoryFolder(root, 'example', { storyJson: JSON.stringify(storyFixture({ name: 'Mine' })) });

            const report = await importStoryFiles(root, stories(), { seeds: [seed] });

            expect(report.imported).toEqual([{ id: 'example', result: 'inserted' }]);
            expect(report.seeded).toEqual([]);
            expect((await stories().read('example'))?.name).toBe('Mine');
        });

        it('copies every seed into an empty database, not only the first one', async () => {
            const demoDir = await writeStoryFolder(seedRoot, 'demo', { tsconfig: STALE_TSCONFIG });
            const demo = { dir: demoDir, file: storyFixture({ name: 'Demo', public: true }) };

            const report = await importStoryFiles(root, stories(), { seeds: [seed, demo] });

            expect(report.seeded).toEqual(['example', 'demo']);
            expect((await stories().read('demo'))?.name).toBe('Demo');
            expect(await fileExists(path.join(root, 'demo', 'tsconfig.json'))).toBe(true);
        });

        it('gives a later seed its row while not copying a seed whose folder is gone', async () => {
            await importStoryFiles(root, stories(), { seeds: [seed] });
            const demoDir = await writeStoryFolder(seedRoot, 'demo');
            const demo = { dir: demoDir, file: storyFixture({ name: 'Demo' }) };

            expect((await importStoryFiles(root, stories(), { seeds: [seed, demo] })).seeded).toEqual([]);
            expect(await fileExists(path.join(root, 'demo', 'tsconfig.json'))).toBe(false);

            await writeStoryFolder(root, 'demo');
            expect((await importStoryFiles(root, stories(), { seeds: [seed, demo] })).seeded).toEqual(['demo']);
        });
    });

    describe('the committed example', () => {
        it('has no story.json: its metadata is the seed in server/seed', async () => {
            expect(await fileExists(path.join(EXAMPLE_STORY_ROOT, STORY_FILE))).toBe(false);
            const { file } = await readStorySeed(EXAMPLE_STORY_ROOT);
            expect(file).toMatchObject({ name: 'Example', public: true, mapSize: { width: 80, height: 60 } });
            expect(await verifyPassword(EXAMPLE_PASSWORD, file.password)).toBe(true);
        });

        it('gives a copy of the example folder the committed seed metadata (the dev checkout)', async () => {
            await copyExampleStory(root, 'example');
            const seed = await readStorySeed(EXAMPLE_STORY_ROOT);

            const report = await importStoryFiles(root, stories(), { seeds: [seed] });

            expect(report).toEqual({ imported: [], skipped: [], tsconfigRewritten: [], seeded: ['example'] });
            expect(await stories().read('example')).toEqual(seed.file);
        });
    });
});
