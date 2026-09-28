import type { TVersion } from '@story/visualizer-protocol';
import type { TTransaction } from '../events/EventBus';
import { version } from '../events/version';
import { HttpError } from '../http/HttpError';
import { readTextOrNull, stringifyJson } from './atomicWrite';

/**
 * Read a JSON store (`map.json`, `*.layout.json`). A missing file is `{ value: null, version: '' }`
 * (`EMPTY_VERSION`), which is what lets a PUT with `version: ''` create it. The version is the hash
 * of the raw file text, so a hand edit and the watcher's event agree on it.
 */
export const readJsonFile = async <T>(file: string): Promise<{ value: T | null; version: TVersion }> => {
    const text = await readTextOrNull(file);
    if (text === null) return { value: null, version: version(null) };
    try {
        return { value: JSON.parse(text) as T, version: version(text) };
    } catch (e) {
        throw HttpError.invalid(
            [{ file, line: 1, column: 1, message: `Not valid JSON: ${(e as Error).message}` }],
            `${file} is not valid JSON`
        );
    }
};

/** Write a JSON store inside a transaction; returns the new version. */
export const writeJsonFile = async (tx: TTransaction, file: string, value: unknown): Promise<TVersion> => {
    const text = stringifyJson(value);
    await tx.writeFile(file, text);
    return version(text);
};
