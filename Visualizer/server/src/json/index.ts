/**
 * The JSON stores (plan §1.1, WP2): `data/locations/map.json` and the `*.layout.json` files.
 *
 *  - `mapStore.ts`    — `GET/PUT /maps/:mapId` (only `global`), the on-disk map format.
 *  - `layoutStore.ts` — `GET/PUT /layout/timeline` and `/layout/chapters/:chapterId`.
 *  - `format.ts`      — the stable, prettier-clean JSON text every store writes.
 *
 * ## Cleanup helpers for the source writers (WP2a)
 *
 * When a passage, chapter, trigger or location is deleted from the `.ts` sources, its view data
 * in the JSON stores has to go too. Call these from *inside your own* `bus.transaction`: they only
 * write (or delete) the JSON file through `tx`, they never call `tx.setEvent` — the one event of
 * the operation stays yours (plan §3 "Live refresh", point 2). Each is a no-op when the file is
 * missing or holds nothing for the given ids, and resolves with `true` when it changed a file.
 *
 *     await bus.transaction(async (tx) => {
 *         await tx.deleteFile(passageFile);
 *         await removePassagePositions(tx, chapterId, [passageId]);
 *         tx.setEvent({ kind: 'passage', id: passageId, version: null, op: 'deleted', chapterId });
 *         return { ok: true };
 *     });
 *
 * They skip the optimistic-concurrency check on purpose: they run inside a transaction (which
 * the bus serialises) and remove only the given keys, so an unrelated concurrent layout edit is
 * kept, and a client holding the old layout version gets a 409 on its next PUT and refetches.
 */
import type { TTransaction } from '../events/EventBus';
import {
    readChapterLayoutFile,
    readTimelineLayoutFile,
    writeChapterLayoutFile,
    writeTimelineLayoutFile,
} from './layoutStore';
import { readMapFile, writeMapFile } from './mapStore';

/** Drop the saved box positions of `passageIds` from `data/chapters/<ch>/<ch>.layout.json`. */
export const removePassagePositions = async (
    tx: TTransaction,
    chapterId: string,
    passageIds: readonly string[]
): Promise<boolean> => {
    const current = await readChapterLayoutFile(tx.project, chapterId);
    if (!current) return false;
    const passages = { ...current.passages };
    let changed = false;
    for (const id of passageIds) {
        if (id in passages) {
            delete passages[id];
            changed = true;
        }
    }
    if (!changed) return false;
    await writeChapterLayoutFile(tx, chapterId, { passages });
    return true;
};

/** Drop a location's polygon from `data/locations/map.json` (the global map). */
export const removeLocationPolygon = async (tx: TTransaction, locationId: string): Promise<boolean> => {
    const current = await readMapFile(tx.project);
    if (!current || !(locationId in current.locations)) return false;
    const locations = { ...current.locations };
    delete locations[locationId];
    await writeMapFile(tx, { ...current, locations });
    return true;
};

/**
 * Delete `data/chapters/<ch>/<ch>.layout.json`. (A `tx.deleteDir` of the whole chapter folder
 * already takes it along; this is for writers that delete the folder file by file.)
 */
export const removeChapterLayout = async (tx: TTransaction, chapterId: string): Promise<boolean> => {
    const current = await readChapterLayoutFile(tx.project, chapterId);
    if (!current) return false;
    await tx.deleteFile(tx.project.paths.chapterLayout(chapterId));
    return true;
};

/** Drop chapter and/or trigger entries from `data/chapters/timeline.layout.json`. */
export const removeTimelineEntries = async (
    tx: TTransaction,
    { chapters = [], triggers = [] }: { chapters?: readonly string[]; triggers?: readonly string[] }
): Promise<boolean> => {
    const current = await readTimelineLayoutFile(tx.project);
    if (!current) return false;
    const next = { chapters: { ...current.chapters }, triggers: { ...current.triggers } };
    let changed = false;
    for (const id of chapters) {
        if (id in next.chapters) {
            delete next.chapters[id];
            changed = true;
        }
    }
    for (const id of triggers) {
        if (id in next.triggers) {
            delete next.triggers[id];
            changed = true;
        }
    }
    if (!changed) return false;
    await writeTimelineLayoutFile(tx, next);
    return true;
};

export {
    readChapterLayout,
    readChapterLayoutFile,
    readTimelineLayout,
    readTimelineLayoutFile,
    updateChapterLayout,
    updateTimelineLayout,
    writeChapterLayoutFile,
    writeTimelineLayoutFile,
} from './layoutStore';
export {
    createDefaultMap,
    decodeMapFile,
    encodeMapFile,
    readMap,
    readMapFile,
    updateMap,
    writeMapFile,
} from './mapStore';
export { formatJson } from './format';
