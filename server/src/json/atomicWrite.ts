import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TMP_SUFFIX = '.vistmp';
export const isTempFile = (file: string) => file.includes(TMP_SUFFIX);

export const isMissingFileError = (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && e.code === 'ENOENT';

// temp file + rename so no reader ever sees a half-written file
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

export const readTextOrNull = async (file: string): Promise<string | null> => {
    try {
        return await readFile(file, 'utf8');
    } catch (e) {
        if (isMissingFileError(e)) return null;
        throw e;
    }
};

export const stringifyJson = (value: unknown) => JSON.stringify(value, null, 4) + '\n';
