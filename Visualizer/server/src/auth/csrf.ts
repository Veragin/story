import type { IncomingMessage } from 'node:http';
import { STORY_ZIP_CONTENT_TYPE, type TRouteName } from '@story/visualizer-protocol';
import { HttpError } from '../http/HttpError';

/**
 * CSRF protection for mutations (multiple stories, phase 4). The session cookie is
 * `SameSite=Lax`, which already keeps it off cross-site `fetch` and form posts in current browsers;
 * this is the second line, for older browsers and same-site-but-cross-origin pages (another port of
 * the same host). Every request whose method is not GET / HEAD must:
 *
 *  1. carry the route's content type, `application/json` (`application/zip` for the zip import,
 *     `MUTATION_CONTENT_TYPES`). An HTML form cannot send either, and a cross-origin `fetch`
 *     that sends one needs a CORS preflight, which this server never grants.
 *  2. come from an allowed origin: when it has an `Origin` header, that origin must be in
 *     `ALLOWED_ORIGINS` or be the request's own (`Origin` host = `Host`). Browsers always send
 *     `Origin` on a cross-origin request and on every non-GET `fetch`, so a request without one
 *     is not from a page (curl, tests) and cannot ride on a victim's cookie.
 *
 * The Vite dev proxies forward `/api` with the browser's `Origin` (http-proxy never rewrites it)
 * and, since they no longer set `changeOrigin`, with the browser's `Host` too, so a page on :8101
 * passes rule 2 as same-origin whatever host name it was opened under. The default list covers
 * proxies that do rewrite `Host`.
 */

/** Content type of each mutation that does not take JSON. */
export const MUTATION_CONTENT_TYPES: Partial<Record<TRouteName, string>> = { importStory: STORY_ZIP_CONTENT_TYPE };

/** Dev ports: SingleEngine 8100, the Visualizer client 8101, the landing page 8103, this server 8123. */
const DEV_PORTS = [8100, 8101, 8103, 8123];

/** `ALLOWED_ORIGINS` when it is not set: each dev port on `localhost` and `127.0.0.1`. */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = DEV_PORTS.flatMap((port) => [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
]);

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '').toLowerCase();

/**
 * `ALLOWED_ORIGINS`: a comma-separated list of origins (`https://stories.example.com`) that
 * replaces the defaults. Unset or empty → `DEFAULT_ALLOWED_ORIGINS`.
 */
export const allowedOriginsFromEnv = (env: NodeJS.ProcessEnv = process.env): string[] => {
    const list = (env.ALLOWED_ORIGINS ?? '').split(',').map(normalizeOrigin).filter(Boolean);
    return list.length > 0 ? list : [...DEFAULT_ALLOWED_ORIGINS];
};

const SAFE_METHODS = new Set(['GET', 'HEAD']);

/** The media type of a `content-type` header, lowercased, without parameters (`; charset=…`). */
const mediaType = (header: string | undefined) => (header ?? '').split(';')[0].trim().toLowerCase();

/**
 * Throw unless a mutation passes both rules above: `400 bad_request` for a wrong content type,
 * `403 forbidden` for a foreign origin. Does nothing for GET / HEAD. `route` is the matched
 * route (it picks the expected content type).
 */
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
