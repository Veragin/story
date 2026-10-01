import type { IncomingMessage } from 'node:http';
import { errorMessage, HttpError } from './HttpError';

// room for a big map.json (every tile is an object)
const MAX_BODY_BYTES = 20 * 1024 * 1024;

const tooLarge = (limit: number) => HttpError.badRequest(`Request body larger than ${limit} bytes`);

const readLimited = async (req: IncomingMessage, limit: number): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buf.length;
        if (size > limit) throw tooLarge(limit);
        chunks.push(buf);
    }
    return Buffer.concat(chunks);
};

export const readJsonBody = async (req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<unknown> => {
    const text = (await readLimited(req, limit)).toString('utf8');
    if (text.trim() === '') return undefined;
    try {
        return JSON.parse(text);
    } catch (e) {
        throw HttpError.badRequest(`Malformed JSON body: ${errorMessage(e)}`);
    }
};

export const readRawBody = async (req: IncomingMessage, limit: number): Promise<Buffer> => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) throw tooLarge(limit);
    return await readLimited(req, limit);
};

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const requireString = (body: Record<string, unknown>, field: string): string => {
    const value = body[field];
    if (typeof value !== 'string' || value === '') {
        throw HttpError.badRequest(`Field "${field}" must be a non-empty string`);
    }
    return value;
};
