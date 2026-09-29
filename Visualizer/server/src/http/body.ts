import type { IncomingMessage } from 'node:http';
import { HttpError } from './HttpError';

/** Large enough for a big `map.json` (every tile is an object), small enough to refuse junk. */
export const MAX_BODY_BYTES = 20 * 1024 * 1024;

/**
 * Read and parse a JSON request body. An empty body is `undefined`; malformed JSON or an
 * oversized body is a 400.
 */
export const readJsonBody = async (req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<unknown> => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
        size += buf.length;
        if (size > limit) {
            throw HttpError.badRequest(`Request body larger than ${limit} bytes`);
        }
        chunks.push(buf);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text.trim() === '') return undefined;
    try {
        return JSON.parse(text) as unknown;
    } catch (e) {
        throw HttpError.badRequest(`Malformed JSON body: ${(e as Error).message}`);
    }
};

/**
 * Read a request body as bytes (the zip import). More than `limit` bytes is a 400: a
 * `content-length` over it is refused before anything is read, a body that turns out longer
 * while streaming as soon as it passes the limit.
 */
export const readRawBody = async (req: IncomingMessage, limit: number): Promise<Buffer> => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
        throw HttpError.badRequest(`Request body larger than ${limit} bytes`);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
        size += buf.length;
        if (size > limit) {
            throw HttpError.badRequest(`Request body larger than ${limit} bytes`);
        }
        chunks.push(buf);
    }
    return Buffer.concat(chunks);
};

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Small body-validation helpers for handlers. Each throws a 400 naming the field.
 *
 *     const chapterId = requireString(body, 'chapterId');
 */
export const requireString = (body: Record<string, unknown>, field: string): string => {
    const value = body[field];
    if (typeof value !== 'string' || value === '') {
        throw HttpError.badRequest(`Field "${field}" must be a non-empty string`);
    }
    return value;
};

export const optionalString = (body: Record<string, unknown>, field: string): string | undefined => {
    const value = body[field];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
        throw HttpError.badRequest(`Field "${field}" must be a string`);
    }
    return value;
};
