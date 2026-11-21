import { readFile } from 'node:fs/promises';

export const isMissingFileError = (e: unknown) =>
    e instanceof Error && 'code' in e && (e.code === 'ENOENT' || e.code === 'EISDIR');

export const readSecretFile = async (file: string): Promise<string | null> => {
    try {
        return (await readFile(file, 'utf8')).trim() || null;
    } catch (e) {
        if (isMissingFileError(e)) return null;
        throw e;
    }
};
