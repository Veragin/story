import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Suffix of the temp files; the watcher ignores anything matching it. */
export const TMP_SUFFIX = '.vistmp';
export const isTempFile = (file: string) => file.includes(TMP_SUFFIX);

/**
 * Write `contents` to `file` so that no reader ever sees a half-written file (plan §3 "Live
 * refresh", point 2): write a sibling temp file, then `rename` it into place (atomic on the same
 * filesystem). Creates missing parent directories. The one write primitive of the server — go
 * through `tx.writeFile` in a `bus.transaction` so the watcher does not echo the write back.
 */
export const atomicWrite = async (file: string, contents: string | Uint8Array): Promise<void> => {
    const dir = path.dirname(file);
    await mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(file)}.${randomBytes(6).toString('hex')}${TMP_SUFFIX}`);
    try {
        await writeFile(tmp, contents);
        await rename(tmp, file);
    } catch (e) {
        await rm(tmp, { force: true });
        throw e;
    }
};

/** Read a file as UTF-8, or `null` when it does not exist. */
export const readTextOrNull = async (file: string): Promise<string | null> => {
    try {
        return await readFile(file, 'utf8');
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw e;
    }
};

/**
 * JSON as the repo formats it (prettier: 4 spaces, trailing newline) — so a JSON file the server
 * writes is already `prettier --check` clean.
 */
export const stringifyJson = (value: unknown) => JSON.stringify(value, null, 4) + '\n';
