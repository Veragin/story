import type { IncomingMessage } from 'node:http';
import type { TLauncherErrorBody } from './httpReplies';

export type TJsonResult = { ok: true; value: unknown } | { ok: false };

export type TJsonBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413; body: TLauncherErrorBody };

const TOO_LARGE: TJsonBodyResult = { ok: false, status: 413, body: { error: 'payload_too_large' } };
const INVALID_JSON: TJsonBodyResult = {
    ok: false,
    status: 400,
    body: { error: 'bad_request', message: 'Invalid JSON' },
};

export const parseJson = (body: Buffer): TJsonResult => {
    try {
        return { ok: true, value: JSON.parse(body.toString('utf8')) };
    } catch {
        return { ok: false };
    }
};

const readCapped = (req: IncomingMessage, maxBytes: number): Promise<Buffer | null> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        const cleanup = () => {
            req.off('data', onData);
            req.off('end', onEnd);
            req.off('error', onError);
        };
        const onData = (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
                cleanup();
                resolve(null);
                return;
            }
            chunks.push(chunk);
        };
        const onEnd = () => {
            cleanup();
            resolve(Buffer.concat(chunks));
        };
        const onError = (e: Error) => {
            cleanup();
            reject(e);
        };
        req.on('data', onData);
        req.once('end', onEnd);
        req.once('error', onError);
    });

export const readJsonBody = async (req: IncomingMessage, maxBytes: number): Promise<TJsonBodyResult> => {
    if (Number(req.headers['content-length']) > maxBytes) return TOO_LARGE;
    const body = await readCapped(req, maxBytes);
    if (body === null) return TOO_LARGE;
    const json = parseJson(body);
    return json.ok ? json : INVALID_JSON;
};
