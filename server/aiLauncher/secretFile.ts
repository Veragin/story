import { readFile } from 'node:fs/promises';

export const readSecretFile = async (file: string): Promise<string | null> => {
    try {
        return (await readFile(file, 'utf8')).trim() || null;
    } catch (e) {
        if (e instanceof Error && 'code' in e && (e.code === 'ENOENT' || e.code === 'EISDIR')) return null;
        throw e;
    }
};
