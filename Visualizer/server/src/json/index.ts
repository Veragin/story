import type { TTransaction } from '../events/EventBus';
import {
    readChapterLayoutFile,
    readTimelineLayoutFile,
    writeChapterLayoutFile,
    writeTimelineLayoutFile,
} from './layoutStore';
import { readMapFile, writeMapFile } from './mapStore';

const withoutKeys = <T>(record: Record<string, T>, ids: readonly string[]) => {
    const next = { ...record };
    let changed = false;
    for (const id of ids) {
        if (id in next) {
            delete next[id];
            changed = true;
        }
    }
    return { next, changed };
};

// no optimistic-concurrency check: these run inside the caller's transaction and only drop the given keys
export const removePassagePositions = async (
    tx: TTransaction,
    chapterId: string,
    passageIds: readonly string[]
): Promise<boolean> => {
    const current = await readChapterLayoutFile(tx.project, chapterId);
    if (!current) return false;
    const passages = withoutKeys(current.passages, passageIds);
    if (!passages.changed) return false;
    await writeChapterLayoutFile(tx, chapterId, { passages: passages.next });
    return true;
};

export const removeLocationPolygon = async (tx: TTransaction, locationId: string): Promise<boolean> => {
    const current = await readMapFile(tx.project);
    if (!current) return false;
    const locations = withoutKeys(current.locations, [locationId]);
    if (!locations.changed) return false;
    await writeMapFile(tx, { ...current, locations: locations.next });
    return true;
};

export const removeChapterLayout = async (tx: TTransaction, chapterId: string): Promise<boolean> => {
    const current = await readChapterLayoutFile(tx.project, chapterId);
    if (!current) return false;
    await tx.deleteFile(tx.project.paths.chapterLayout(chapterId));
    return true;
};

export const removeTimelineEntries = async (
    tx: TTransaction,
    { chapters = [], triggers = [] }: { chapters?: readonly string[]; triggers?: readonly string[] }
): Promise<boolean> => {
    const current = await readTimelineLayoutFile(tx.project);
    if (!current) return false;
    const nextChapters = withoutKeys(current.chapters, chapters);
    const nextTriggers = withoutKeys(current.triggers, triggers);
    if (!nextChapters.changed && !nextTriggers.changed) return false;
    await writeTimelineLayoutFile(tx, { chapters: nextChapters.next, triggers: nextTriggers.next });
    return true;
};

export { createDefaultMap, decodeMapFile, encodeMapFile } from './mapStore';
