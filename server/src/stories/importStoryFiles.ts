import { randomBytes } from 'node:crypto';
import { cp, lstat, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { isStoryId } from '@story/protocol';
import { isMissingFileError, readTextOrNull } from '../json/atomicWrite';
import { parseStoryFile, STORY_FILE } from './storyFile';
import type { StoryRepository, TUpsertResult } from './StoryRepository';
import { migrateStoryTsconfig } from './storyTsconfig';

export type TImportStoryFilesReport = {
    imported: { id: string; result: TUpsertResult }[];
    skipped: { id: string; reason: string }[];
    tsconfigRewritten: string[];
    seeded: string | null;
};

export type TImportStoryFilesOptions = {
    // copied into the root when the database holds no story yet
    seed?: string;
};

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const exists = async (file: string) => (await lstat(file).catch(() => null)) !== null;

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
    report: TImportStoryFilesReport
): Promise<void> => {
    const dir = path.join(root, id);
    const storyFile = path.join(dir, STORY_FILE);
    try {
        const text = await readTextOrNull(storyFile);
        if (text === null && !(await stories.exists(id))) {
            report.skipped.push({ id, reason: `no ${STORY_FILE} and no database row` });
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

const seedStory = async (root: string, seed: string): Promise<string | null> => {
    const id = path.basename(seed);
    const target = path.join(root, id);
    if (await exists(target)) return null;
    // a dot name is never a story id, so nothing picks up a half-copied folder
    const tmp = path.join(root, `.seed-${randomBytes(6).toString('hex')}`);
    try {
        await cp(seed, tmp, { recursive: true });
        await rename(tmp, target);
    } catch (e) {
        await rm(tmp, { recursive: true, force: true });
        throw e;
    }
    return id;
};

export const importStoryFiles = async (
    root: string,
    stories: StoryRepository,
    options: TImportStoryFilesOptions = {}
): Promise<TImportStoryFilesReport> => {
    const report: TImportStoryFilesReport = { imported: [], skipped: [], tsconfigRewritten: [], seeded: null };
    for (const id of await storyDirs(root)) await importStory(root, id, stories, report);
    if (options.seed !== undefined && (await stories.count()) === 0) {
        await mkdir(root, { recursive: true });
        report.seeded = await seedStory(root, options.seed);
        if (report.seeded !== null) await importStory(root, report.seeded, stories, report);
    }
    return report;
};
