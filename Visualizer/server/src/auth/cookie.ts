import type { IncomingMessage } from 'node:http';
import { SESSION_COOKIE } from '@story/visualizer-protocol';

const COOKIE_MAX_AGE_S = 24 * 60 * 60;

export const cookieSecureFromEnv = (env: NodeJS.ProcessEnv = process.env) => env.COOKIE_SECURE?.trim() === '1';

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

export const sessionCookie = (token: string, secure: boolean) =>
    [
        `${SESSION_COOKIE}=${token}`,
        'HttpOnly',
        'SameSite=Lax',
        'Path=/',
        `Max-Age=${COOKIE_MAX_AGE_S}`,
        ...(secure ? ['Secure'] : []),
    ].join('; ');

export const clearedSessionCookie = (secure: boolean) =>
    [`${SESSION_COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0', ...(secure ? ['Secure'] : [])].join('; ');
