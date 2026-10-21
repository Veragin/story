import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { lstatOrNull } from '../common/fileStat';
import { isTempFile } from '../json/atomicWrite';

export const STORY_TOP_FILES = ['tsconfig.json'];
export const STORY_TOP_DIRS = ['data', 'types'];

const ALWAYS_SKIPPED_DIRS = ['node_modules'];

export const listStoryDirFiles = async (storyDir: string, skippedDirs: readonly string[] = []): Promise<string[]> => {
    const skipped = new Set([...ALWAYS_SKIPPED_DIRS, ...skippedDirs]);
    const out: string[] = [];
    const walk = async (rel: string) => {
        const entries = await readdir(path.join(storyDir, rel), { withFileTypes: true });
        for (const e of entries) {
            const childRel = `${rel}/${e.name}`;
            if (e.isDirectory()) {
                if (!skipped.has(e.name)) await walk(childRel);
            } else if (e.isFile() && !isTempFile(e.name)) {
                out.push(childRel);
            }
            // anything else (a symlink, a socket) is not part of a story
        }
    };
    for (const name of STORY_TOP_DIRS) {
        if ((await lstatOrNull(path.join(storyDir, name)))?.isDirectory()) await walk(name);
    }
    return out;
};
