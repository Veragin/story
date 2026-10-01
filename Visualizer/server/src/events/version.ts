import { createHash } from 'node:crypto';
import { EMPTY_VERSION, type TVersion } from '@story/visualizer-protocol';
import { HttpError } from '../http/HttpError';

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

export const assertVersion = async (
    expected: TVersion,
    actual: TVersion,
    current: () => unknown | Promise<unknown>
): Promise<void> => {
    if (expected !== actual) {
        throw HttpError.stale(await current());
    }
};
