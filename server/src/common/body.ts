import type { Readable } from 'node:stream';
import { errorMessage, HttpError } from './HttpError';
import { isPlainObject } from './isPlainObject';

// room for a big map.json (every tile is an object)
export const MAX_JSON_BODY_BYTES = 20 * 1024 * 1024;

export const bodyTooLarge = (limit: number) => HttpError.badRequest(`Request body larger than ${limit} bytes`);

const readLimited = async (stream: Readable, limit: number): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        size += buf.length;
        if (size > limit) throw bodyTooLarge(limit);
        chunks.push(buf);
    }
    return Buffer.concat(chunks);
};

export const readJsonBody = async (stream: Readable, limit = MAX_JSON_BODY_BYTES): Promise<unknown> => {
    const text = (await readLimited(stream, limit)).toString('utf8');
    if (text.trim() === '') return undefined;
    try {
        return JSON.parse(text);
    } catch (e) {
        throw HttpError.badRequest(`Malformed JSON body: ${errorMessage(e)}`);
    }
};

export const jsonObjectBody = (body: unknown): Record<string, unknown> => {
    if (!isPlainObject(body)) throw HttpError.badRequest('Expected a JSON object body');
    return body;
};

export const versionedBody = (body: Record<string, unknown>): Record<string, unknown> => {
    if (typeof body.version !== 'string') {
        throw HttpError.badRequest('Field "version" must be a string (the version the change is based on)');
    }
    return body;
};

export const requireString = (body: Record<string, unknown>, field: string): string => {
    const value = body[field];
    if (typeof value !== 'string' || value === '') {
        throw HttpError.badRequest(`Field "${field}" must be a non-empty string`);
    }
    return value;
};
