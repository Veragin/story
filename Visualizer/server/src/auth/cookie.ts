import type { IncomingMessage } from 'node:http';
import { SESSION_COOKIE } from '@story/visualizer-protocol';

/** The cookie lives as long as a grant (`GRANT_TTL_MS`); every login renews it. */
const COOKIE_MAX_AGE_S = 24 * 60 * 60;

/** `COOKIE_SECURE=1` adds `Secure` (production behind HTTPS). Off by default: dev is plain http. */
export const cookieSecureFromEnv = (env: NodeJS.ProcessEnv = process.env) => env.COOKIE_SECURE?.trim() === '1';

/** The session token of a request's `story_session` cookie, if it sends one. */
export const readSessionToken = (req: IncomingMessage): string | undefined => {
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0 || part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
        const value = part.slice(eq + 1).trim();
        return value === '' ? undefined : value;
    }
    return undefined;
};

/**
 * The `set-cookie` value that stores a session token. `HttpOnly` keeps it from page scripts,
 * `SameSite=Lax` keeps it off cross-site subrequests and form posts (the CSRF check in `csrf.ts`
 * is the second line), and `Path=/` sends it to every service: browsers share cookies across ports
 * of one host, so in dev one login reaches :8100, :8101 and :8103 through their Vite proxies.
 */
export const sessionCookie = (token: string, secure: boolean) =>
    [
        `${SESSION_COOKIE}=${token}`,
        'HttpOnly',
        'SameSite=Lax',
        'Path=/',
        `Max-Age=${COOKIE_MAX_AGE_S}`,
        ...(secure ? ['Secure'] : []),
    ].join('; ');

/** The `set-cookie` value that deletes the session cookie (logout). */
export const clearedSessionCookie = (secure: boolean) =>
    [`${SESSION_COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0', ...(secure ? ['Secure'] : [])].join('; ');
