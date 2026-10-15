import type { IncomingMessage } from 'node:http';
import { STORY_ZIP_CONTENT_TYPE, type TRouteName } from '@story/visualizer-protocol';
import { HttpError } from '../http/HttpError';

const MUTATION_CONTENT_TYPES: Partial<Record<TRouteName, string>> = { importStory: STORY_ZIP_CONTENT_TYPE };

const DEV_PORTS = [8100, 8101, 8103, 8123];

const DEFAULT_ALLOWED_ORIGINS: readonly string[] = DEV_PORTS.flatMap((port) => [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
]);

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '').toLowerCase();

export const allowedOriginsFromEnv = (env: NodeJS.ProcessEnv = process.env): string[] => {
    const list = (env.ALLOWED_ORIGINS ?? '').split(',').map(normalizeOrigin).filter(Boolean);
    return list.length > 0 ? list : [...DEFAULT_ALLOWED_ORIGINS];
};

const SAFE_METHODS = new Set(['GET', 'HEAD']);

const mediaType = (header: string | undefined) => (header ?? '').split(';')[0].trim().toLowerCase();

export const assertSafeMutation = (
    req: IncomingMessage,
    allowedOrigins: ReadonlySet<string>,
    route: TRouteName
): void => {
    if (SAFE_METHODS.has(req.method ?? 'GET')) return;

    const expected = MUTATION_CONTENT_TYPES[route] ?? 'application/json';
    if (mediaType(req.headers['content-type']) !== expected) {
        throw HttpError.badRequest(`Expected content-type ${expected}`);
    }

    const origin = req.headers.origin;
    // browsers always send Origin on non-GET fetch, so its absence means no page (and no victim cookie)
    if (origin === undefined) return;
    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.has(normalized)) return;
    let host: string | null = null;
    try {
        host = new URL(normalized).host;
    } catch {
        // `Origin: null` (sandboxed frames, file://) and junk never match
    }
    if (host !== null && host === req.headers.host?.toLowerCase()) return;
    throw HttpError.forbidden(`Origin ${origin} is not allowed (ALLOWED_ORIGINS)`);
};
