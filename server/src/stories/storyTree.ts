import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { TMapSizeDto } from '@story/protocol';
import { HttpError } from '../common/HttpError';
import { readBytesOrNull } from '../json/atomicWrite';
import { MAP_FILE } from '../json/mapFile';
import { storyMapSize } from './storyInput';
import { STORY_TOP_DIRS, STORY_TOP_FILES } from './storyFiles';

const STORY_ENTRIES = [...STORY_TOP_FILES, ...STORY_TOP_DIRS.map((d) => `${d}/`)].join(', ');

const refuseSymlinks = async (root: string, rel: string, source: string): Promise<void> => {
    for (const entry of await readdir(path.join(root, rel), { withFileTypes: true })) {
        const childRel = `${rel}/${entry.name}`;
        if (entry.isSymbolicLink()) throw HttpError.badRequest(`The ${source}'s ${childRel} is a symlink`);
        if (entry.isDirectory()) await refuseSymlinks(root, childRel, source);
    }
};

// the folder-level twin of the import zip checks; `extraEntries` at the root are skipped unread.
// Unlike a zip, a folder may lack the map (null): a story without one shows the default map
export const checkStoryTree = async (
    dir: string,
    source: string,
    extraEntries: readonly string[] = []
): Promise<TMapSizeDto | null> => {
    const seen = new Set<string>();
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (extraEntries.includes(entry.name)) continue;
        const asFile = STORY_TOP_FILES.includes(entry.name) && entry.isFile();
        const asDir = STORY_TOP_DIRS.includes(entry.name) && entry.isDirectory();
        if (!asFile && !asDir) {
            throw HttpError.badRequest(`The ${source} holds "${entry.name}": a story holds only ${STORY_ENTRIES}`);
        }
        seen.add(entry.name);
    }
    const missing = [...STORY_TOP_FILES, ...STORY_TOP_DIRS].filter((name) => !seen.has(name));
    if (missing.length > 0) throw HttpError.badRequest(`The ${source} is not a story: no ${missing.join(', ')}`);
    for (const name of STORY_TOP_DIRS) await refuseSymlinks(dir, name, source);
    const map = await readBytesOrNull(path.join(dir, ...MAP_FILE.split('/')));
    return map === null ? null : storyMapSize(map, source);
};
