import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXAMPLE_STORY_ROOT } from '../src/project/ProjectRoot';
import { importStoryFiles } from '../src/stories/importStoryFiles';
import { parseStoryFile, STORY_FILE } from '../src/stories/storyFile';
import { StoryRepository } from '../src/stories/StoryRepository';
import { storyTsconfig } from '../src/stories/storyTsconfig';
import { setupTestDatabase } from './helpers/database';
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
            seeded: null,
        });
        expect(await stories().readVersioned('alpha')).toEqual({ file: storyFixture(), version: '1' });
        expect(await fileExists(path.join(dir, STORY_FILE))).toBe(false);
        expect(await readFile(path.join(dir, 'tsconfig.json'), 'utf8')).toBe(await storyTsconfig(dir));
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
            seeded: null,
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
            seeded: null,
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

    it('imports the committed example story (the seed input)', async () => {
        const dir = await copyExampleStory(root, 'example');
        const committed = parseStoryFile(JSON.parse(await readFile(path.join(EXAMPLE_STORY_ROOT, STORY_FILE), 'utf8')));

        const report = await importStoryFiles(root, stories());

        expect(report.imported).toEqual([{ id: 'example', result: 'inserted' }]);
        expect(report.tsconfigRewritten).toEqual(['example']);
        expect(await stories().read('example')).toEqual(committed);
        expect(await fileExists(path.join(dir, STORY_FILE))).toBe(false);
        expect(await fileExists(path.join(EXAMPLE_STORY_ROOT, STORY_FILE))).toBe(true);
    });

    describe('seed', () => {
        let seedRoot: string;
        let seed: string;
        let cleanupSeed: () => Promise<void>;

        beforeEach(async () => {
            ({ root: seedRoot, cleanup: cleanupSeed } = await makeTempStoriesRoot());
            seed = await writeStoryFolder(seedRoot, 'example', {
                storyJson: JSON.stringify(storyFixture({ name: 'Example', public: true })),
                tsconfig: STALE_TSCONFIG,
            });
        });
        afterEach(() => cleanupSeed());

        it('copies and imports the seed into an empty database, leaving the seed itself alone', async () => {
            const target = path.join(root, 'missing-root');

            const report = await importStoryFiles(target, stories(), { seed });

            expect(report).toEqual({
                imported: [{ id: 'example', result: 'inserted' }],
                skipped: [],
                tsconfigRewritten: ['example'],
                seeded: 'example',
            });
            expect((await stories().read('example'))?.name).toBe('Example');
            expect(await fileExists(path.join(target, 'example', STORY_FILE))).toBe(false);
            expect(await fileExists(path.join(seed, STORY_FILE))).toBe(true);

            expect((await importStoryFiles(target, stories(), { seed })).seeded).toBeNull();
        });

        it('does not seed when the database already holds a story', async () => {
            await writeStoryFolder(root, 'alpha', { storyJson: JSON.stringify(storyFixture()) });

            const report = await importStoryFiles(root, stories(), { seed });

            expect(report.seeded).toBeNull();
            expect(await fileExists(path.join(root, 'example'))).toBe(false);
        });
    });
});
