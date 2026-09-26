import { createHash } from 'node:crypto';
import { EMPTY_VERSION, type TVersion } from '@story/visualizer-protocol';
import { HttpError } from '../http/HttpError';

/**
 * The resource version (plan §3 "Live refresh", point 3): a content hash of the file(s) backing a
 * resource. Pass several contents for a resource backed by more than one file — order matters.
 * `null` (a file that does not exist) hashes to `EMPTY_VERSION` (`''`) when it is the only input.
 *
 *     const v = version(await readTextOrNull(file));
 */
export const version = (...contents: (string | Uint8Array | null | undefined)[]): TVersion => {
    if (contents.length === 0 || contents.every((c) => c === null || c === undefined)) {
        return EMPTY_VERSION;
    }
    const hash = createHash('sha256');
    for (const c of contents) {
        if (c === null || c === undefined) {
            hash.update('\0null\0');
        } else {
            hash.update(String(typeof c === 'string' ? Buffer.byteLength(c) : c.byteLength));
            hash.update('\0');
            hash.update(c);
        }
    }
    return hash.digest('hex').slice(0, 16);
};

/**
 * Optimistic-concurrency check for PUT / DELETE (plan §3 "Live refresh", point 3): throws the
 * 409 `stale` error, carrying the current DTO, when the body's version is not the one on disk.
 * Pass `current` lazily so the DTO is only built on a mismatch.
 */
export const assertVersion = async (
    expected: TVersion,
    actual: TVersion,
    current: () => unknown | Promise<unknown>
): Promise<void> => {
    if (expected !== actual) {
        throw HttpError.stale(await current());
    }
};
