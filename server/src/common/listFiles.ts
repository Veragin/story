import { readdir } from 'node:fs/promises';
import path from 'node:path';

// a missing folder lists as empty
export const listFilesRecursive = async (dir: string): Promise<string[]> => {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const files: string[] = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...(await listFilesRecursive(full)));
        else files.push(full);
    }
    return files;
};
