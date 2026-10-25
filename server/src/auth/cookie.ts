import type { IncomingMessage } from 'node:http';
import { SESSION_COOKIE } from '@story/protocol';

const COOKIE_MAX_AGE_S = 24 * 60 * 60;

// `__Host-` (Secure only): the play subdomain's story code cannot plant a session cookie for this host
const cookieName = (secure: boolean) => (secure ? `__Host-${SESSION_COOKIE}` : SESSION_COOKIE);

export const readSessionToken = (req: IncomingMessage, secure: boolean): string | undefined => {
    const header = req.headers.cookie;
    if (!header) return undefined;
    const name = cookieName(secure);
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
        const value = part.slice(eq + 1).trim();
        return value === '' ? undefined : value;
    }
    return undefined;
};

export const sessionCookie = (token: string, secure: boolean) =>
    [
        `${cookieName(secure)}=${token}`,
        'HttpOnly',
        'SameSite=Lax',
        'Path=/',
        `Max-Age=${COOKIE_MAX_AGE_S}`,
        ...(secure ? ['Secure'] : []),
    ].join('; ');

export const clearedSessionCookie = (secure: boolean) =>
    [`${cookieName(secure)}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0', ...(secure ? ['Secure'] : [])].join(
        '; '
    );
