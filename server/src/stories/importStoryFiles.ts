import { randomBytes } from 'node:crypto';
import { cp, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { isStoryId } from '@story/protocol';
import { exists } from '../common/fileStat';
import { errorMessage } from '../common/HttpError';
import { isMissingFileError, readTextOrNull } from '../json/atomicWrite';
import { parseStoryFile, STORY_FILE } from './storyFile';
import type { StoryRepository, TUpsertResult } from '../database/repositories/StoryRepository';
import { storySeedId, type TStorySeed } from './storySeed';
import { migrateStoryTsconfig } from './storyTsconfig';

export type TImportStoryFilesReport = {
    imported: { id: string; result: TUpsertResult }[];
    skipped: { id: string; reason: string }[];
    tsconfigRewritten: string[];
    seeded: string | null;
};

export type TImportStoryFilesOptions = {
    seed?: TStorySeed;
};

const storyDirs = async (root: string): Promise<string[]> => {
    try {
        const entries = await readdir(root, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isDirectory() && isStoryId(entry.name))
            .map((entry) => entry.name)
            .sort();
    } catch (e) {
        if (isMissingFileError(e)) return [];
        throw e;
    }
};

const importStory = async (
    root: string,
    id: string,
    stories: StoryRepository,
    report: TImportStoryFilesReport,
    seedId: string | undefined
): Promise<void> => {
    const dir = path.join(root, id);
    const storyFile = path.join(dir, STORY_FILE);
    try {
        const text = await readTextOrNull(storyFile);
        if (text === null && !(await stories.exists(id))) {
            if (id !== seedId) report.skipped.push({ id, reason: `no ${STORY_FILE} and no database row` });
            return;
        }
        const result = text === null ? null : await stories.upsert(id, parseStoryFile(JSON.parse(text)));
        if (await migrateStoryTsconfig(dir)) report.tsconfigRewritten.push(id);
        if (result === null) return;
        // only after the row and the tsconfig are in place, so a failed run is simply rerun
        await rm(storyFile);
        report.imported.push({ id, result });
    } catch (e) {
        report.skipped.push({ id, reason: errorMessage(e) });
    }
};

const copySeed = async (seedDir: string, target: string): Promise<void> => {
    await mkdir(path.dirname(target), { recursive: true });
    // a dot name is never a story id, so nothing picks up a half-copied folder
    const tmp = path.join(path.dirname(target), `.seed-${randomBytes(6).toString('hex')}`);
    try {
        await cp(seedDir, tmp, { recursive: true });
        await rename(tmp, target);
    } catch (e) {
        await rm(tmp, { recursive: true, force: true });
        throw e;
    }
};

// A seed folder without a row gets the seed's metadata; a missing folder is copied in only while the
// database holds no story at all (a fresh install), so a story deleted later stays deleted.
const seedStory = async (root: string, seed: TStorySeed, stories: StoryRepository): Promise<string | null> => {
    const id = storySeedId(seed);
    if (await stories.exists(id)) return null;
    const target = path.join(root, id);
    if (!(await exists(target))) {
        if ((await stories.count()) > 0) return null;
        await copySeed(seed.dir, target);
    }
    await stories.insert(id, seed.file);
    await migrateStoryTsconfig(target);
    return id;
};

export const importStoryFiles = async (
    root: string,
    stories: StoryRepository,
    options: TImportStoryFilesOptions = {}
): Promise<TImportStoryFilesReport> => {
    const { seed } = options;
    const report: TImportStoryFilesReport = { imported: [], skipped: [], tsconfigRewritten: [], seeded: null };
    const seedId = seed === undefined ? undefined : storySeedId(seed);
    for (const id of await storyDirs(root)) await importStory(root, id, stories, report, seedId);
    if (seed !== undefined) report.seeded = await seedStory(root, seed, stories);
    return report;
};
