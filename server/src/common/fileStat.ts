import type { Stats } from 'node:fs';
import { lstat } from 'node:fs/promises';
import path from 'node:path';

export const lstatOrNull = (file: string): Promise<Stats | null> => lstat(file).catch(() => null);

export const exists = async (file: string): Promise<boolean> => (await lstatOrNull(file)) !== null;

// a symlink anywhere on the way could lead out of `root`
export const isRegularFileWithin = async (root: string, segments: readonly string[]): Promise<boolean> => {
    for (let i = 1; i <= segments.length; i++) {
        const stats = await lstatOrNull(path.join(root, ...segments.slice(0, i)));
        const ok = i < segments.length ? stats?.isDirectory() : stats?.isFile();
        if (!ok) return false;
    }
    return true;
};
