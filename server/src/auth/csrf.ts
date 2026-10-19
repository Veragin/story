import type { IncomingMessage } from 'node:http';
import type { TRouteName } from '@story/protocol';
import { HttpError } from '../common/HttpError';
import { routeContentType } from '../common/routeBody';
import { normalizeOrigin } from '../config/env';

const DEV_PORTS = [8100, 8101, 8103, 8123];

export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = DEV_PORTS.flatMap((port) => [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
]);

const SAFE_METHODS = new Set(['GET', 'HEAD']);

const mediaType = (header: string | undefined) => (header ?? '').split(';')[0].trim().toLowerCase();

export const assertSafeMutation = (
    req: IncomingMessage,
    allowedOrigins: ReadonlySet<string>,
    route: TRouteName
): void => {
    if (SAFE_METHODS.has(req.method ?? 'GET')) return;

    const expected = routeContentType(route);
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
