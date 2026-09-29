import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPath, STORY_ROUTES, type TRouteParams, type TStoryRouteName } from '@story/visualizer-protocol';
import { LoginLimiter } from '../src/auth/LoginLimiter';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { GRANT_TTL_MS, SessionStore } from '../src/auth/SessionStore';
import { createApp, type TApp, type TAppOptions } from '../src/app';
import { EXAMPLE_STORY_ROOT } from '../src/project/ProjectRoot';
import { PUBLIC_STORY_READS } from '../src/stories/access';
import { STORY_FILE } from '../src/stories/StoryStore';
import { EXAMPLE_PASSWORD, login, makeTempStories, sleep } from './helpers';

/**
 * Security (multiple stories, phase 4): password hashing, session grants, the grant check on every
 * story route, the cookie, CSRF and the login rate limit. `example` is public (like the real one),
 * `secret` is a private copy of it.
 */

describe('password', () => {
    it('verifies the example story hash', async () => {
        const { password } = JSON.parse(await readFile(path.join(EXAMPLE_STORY_ROOT, STORY_FILE), 'utf8')) as {
            password: string;
        };
        expect(await verifyPassword(EXAMPLE_PASSWORD, password)).toBe(true);
        expect(await verifyPassword('Example', password)).toBe(false);
    });

    it('hashes with a random salt in the self-describing format', async () => {
        const a = await hashPassword('hunter2');
        const b = await hashPassword('hunter2');
        expect(a).toMatch(/^scrypt\$16384\$8\$1\$[\w-]{22}\$[\w-]{86}$/);
        expect(a).not.toBe(b);
        expect(await verifyPassword('hunter2', a)).toBe(true);
        expect(await verifyPassword('hunter3', a)).toBe(false);
        expect(await verifyPassword('', a)).toBe(false);
    });

    it('never matches a malformed, foreign or too expensive hash', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const [, , , , salt, key] = (await hashPassword('x')).split('$');
        for (const stored of [
            '',
            'x',
            'sha256$abc$def',
            `scrypt$1000$8$1$${salt}$${key}`, // N not a power of two
            `scrypt$${2 ** 30}$8$1$${salt}$${key}`, // would allocate gigabytes
            `scrypt$16384$8$1$$${key}`,
            `scrypt$16384$8$1$${salt}$`,
        ]) {
            expect(await verifyPassword('x', stored)).toBe(false);
        }
        vi.restoreAllMocks();
    });
});

describe('SessionStore', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('grants a story for 24 h from the login, several stories per session', () => {
        vi.useFakeTimers();
        const sessions = new SessionStore();
        const { token, expiresAt } = sessions.grant(undefined, 'alpha');
        expect(token).toMatch(/^[\w-]{43}$/);
        expect(expiresAt).toBe(Date.now() + GRANT_TTL_MS);

        vi.advanceTimersByTime(GRANT_TTL_MS / 2);
        expect(sessions.grant(token, 'beta').token).toBe(token);
        expect(sessions.storyIds(token)).toEqual(['alpha', 'beta']);

        vi.advanceTimersByTime(GRANT_TTL_MS / 2 - 1);
        expect(sessions.expiresAt(token, 'alpha')).toBe(expiresAt);
        vi.advanceTimersByTime(1);
        expect(sessions.expiresAt(token, 'alpha')).toBeNull();
        expect(sessions.storyIds(token)).toEqual(['beta']);

        vi.advanceTimersByTime(GRANT_TTL_MS / 2);
        expect(sessions.storyIds(token)).toEqual([]);
        expect(sessions.size).toBe(0);
        sessions.close();
    });

    it('prunes expired sessions on a timer, and starts a new session for an unknown token', () => {
        vi.useFakeTimers();
        const sessions = new SessionStore({ ttlMs: 1000, pruneMs: 500 });
        const { token } = sessions.grant(undefined, 'alpha');
        const internal = (sessions as unknown as { sessions: Map<string, unknown> }).sessions;
        vi.advanceTimersByTime(1500);
        expect(internal.size).toBe(0); // the timer did it, without an access

        const fresh = sessions.grant(token, 'alpha');
        expect(fresh.token).not.toBe(token);
        sessions.revoke(fresh.token);
        expect(sessions.expiresAt(fresh.token, 'alpha')).toBeNull();
        sessions.close();
    });
});

describe('LoginLimiter', () => {
    it('blocks a key after the failures, until the window ends; success clears it', () => {
        const limiter = new LoginLimiter({ maxFailures: 3, windowMs: 1000 });
        for (let i = 0; i < 3; i++) {
            expect(limiter.isBlocked('k', 0)).toBe(false);
            limiter.fail('k', i);
        }
        expect(limiter.isBlocked('k', 999)).toBe(true);
        expect(limiter.isBlocked('other', 999)).toBe(false);
        expect(limiter.isBlocked('k', 1000)).toBe(false);
        limiter.fail('k', 1000);
        limiter.succeed('k');
        expect(limiter.isBlocked('k', 1001)).toBe(false);
        limiter.close();
    });
});

describe('over HTTP', () => {
    let app: TApp;
    let base: string;
    let cleanup: () => Promise<void>;

    const start = async (options: Partial<TAppOptions> = {}) => {
        const temp = await makeTempStories(['example', 'secret']);
        cleanup = temp.cleanup;
        const secretFile = path.join(temp.storiesRoot, 'secret', STORY_FILE);
        const secret = JSON.parse(await readFile(secretFile, 'utf8')) as Record<string, unknown>;
        await writeFile(secretFile, JSON.stringify({ ...secret, name: 'Secret', public: false }));
        app = await createApp({ storiesRoot: temp.storiesRoot, watch: false, ...options });
        base = `http://127.0.0.1:${await app.listen(0, '127.0.0.1')}`;
    };

    afterEach(async () => {
        await app.close();
        await cleanup();
    });

    const call = async (method: string, url: string, headers: Record<string, string> = {}, body?: unknown) => {
        const res = await fetch(base + url, {
            method,
            headers: method === 'GET' ? headers : { 'content-type': 'application/json', ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { status: res.status, headers: res.headers, body: (text ? JSON.parse(text) : undefined) as any };
    };

    const tryLogin = (storyId: string, password: string, headers: Record<string, string> = {}) =>
        call('POST', `/api/stories/${storyId}/login`, headers, { password });

    /** Every story route of `storyId`, with made-up parameters and a plausible body. */
    const everyRoute = (storyId: string) =>
        (Object.keys(STORY_ROUTES) as TStoryRouteName[]).map((route) => {
            const { method, path: template } = STORY_ROUTES[route];
            const params = Object.fromEntries(
                [...template.matchAll(/:([A-Za-z]+)/g)].map(([, name]) => [
                    name,
                    name === 'kind' ? 'npcs' : name === 'owner' ? 'passages' : name === 'mapId' ? 'global' : 'x',
                ])
            );
            return { route, method, url: buildPath(storyId, route, params as TRouteParams<typeof route>) };
        });

    it('answers 401 on every story route without a grant, and never loads the story', async () => {
        await start();
        const other = await login(base, 'example'); // a grant for another story does not help
        for (const cookie of [undefined, 'story_session=forged', other]) {
            for (const { route, method, url } of everyRoute('secret')) {
                const res = await call(method, url, cookie ? { cookie } : {}, method === 'GET' ? undefined : {});
                expect([route, res.status, res.body?.error]).toEqual([route, 401, 'unauthorized']);
            }
        }
        expect(app.contexts.loadedIds()).toEqual([]); // logging in does not load a story either
    }, 60_000);

    it('lets only the art of a public story through without a grant', async () => {
        await start();
        for (const { route, method, url } of everyRoute('example')) {
            const res = await call(method, url, {}, method === 'GET' ? undefined : {});
            if (PUBLIC_STORY_READS.includes(route)) expect([route, res.status]).not.toEqual([route, 401]);
            else expect([route, res.status]).toEqual([route, 401]);
        }
        const image = await call('GET', '/api/stories/example/images/passages/village-thomas-intro');
        expect(image.status).toBe(200);
        expect((await fetch(base + image.body.url)).status).toBe(200);
    }, 60_000);

    it('logs in with the password: 204, the cookie flags, then the story answers', async () => {
        await start();
        const wrong = await tryLogin('secret', 'nope');
        expect(wrong.status).toBe(401);
        expect(wrong.headers.get('set-cookie')).toBeNull();
        expect((await tryLogin('nope', EXAMPLE_PASSWORD)).status).toBe(404);
        expect((await call('POST', '/api/stories/secret/login', {}, {})).status).toBe(400);

        const ok = await tryLogin('secret', EXAMPLE_PASSWORD);
        expect(ok.status).toBe(204);
        const setCookie = ok.headers.get('set-cookie')!;
        expect(setCookie).toMatch(/^story_session=[\w-]{43}; /);
        const flags = setCookie.split('; ').slice(1);
        expect(flags).toEqual(['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=86400']);

        const cookie = setCookie.split(';')[0];
        const project = await call('GET', '/api/stories/secret/project', { cookie });
        expect(project.status).toBe(200);
        expect(project.body.chapters.length).toBeGreaterThan(0);
    });

    it('adds Secure with cookieSecure (COOKIE_SECURE=1)', async () => {
        await start({ cookieSecure: true });
        const ok = await tryLogin('secret', EXAMPLE_PASSWORD);
        expect(ok.headers.get('set-cookie')).toMatch(/; Secure$/);
        const out = await call('POST', '/api/logout', { cookie: ok.headers.get('set-cookie')!.split(';')[0] });
        expect(out.headers.get('set-cookie')).toMatch(/^story_session=; .*Max-Age=0; Secure$/);
    });

    it('keeps several grants in one cookie; session, access and logout', async () => {
        await start();
        expect((await call('GET', '/api/session')).body).toEqual({ storyIds: [] });
        expect((await call('GET', '/api/stories/secret/access')).body).toEqual({ canEdit: false, canPlay: false });
        expect((await call('GET', '/api/stories/example/access')).body).toEqual({ canEdit: false, canPlay: true });
        expect((await call('GET', '/api/stories/nope/access')).status).toBe(404);

        const first = await login(base, 'secret');
        const cookie = await login(base, 'example', { cookie: first });
        expect(cookie).toBe(first);
        expect((await call('GET', '/api/session', { cookie })).body).toEqual({ storyIds: ['example', 'secret'] });
        expect((await call('GET', '/api/stories/secret/access', { cookie })).body).toEqual({
            canEdit: true,
            canPlay: true,
        });
        expect((await call('GET', '/api/stories/example/project', { cookie })).status).toBe(200);

        const out = await call('POST', '/api/logout', { cookie });
        expect(out.status).toBe(204);
        expect(out.headers.get('set-cookie')).toMatch(/^story_session=; .*Max-Age=0/);
        expect((await call('GET', '/api/stories/secret/project', { cookie })).status).toBe(401);
        expect((await call('GET', '/api/session', { cookie })).body).toEqual({ storyIds: [] });
    });

    it('refuses a grant once it expired', async () => {
        await start({ sessions: new SessionStore({ ttlMs: 300 }) });
        const cookie = await login(base, 'secret');
        expect((await call('GET', '/api/stories/secret/project', { cookie })).status).toBe(200);
        await sleep(400);
        expect((await call('GET', '/api/stories/secret/project', { cookie })).status).toBe(401);
    });

    it('closes the change feed when its grant expires', async () => {
        await start({ sessions: new SessionStore({ ttlMs: 1500 }) });
        const cookie = await login(base, 'secret');
        const req = http.get(`${base}/api/stories/secret/events`, { headers: { cookie } });
        const response = await new Promise<http.IncomingMessage>((resolve) => req.on('response', resolve));
        expect(response.statusCode).toBe(200);
        const opened = Date.now();
        response.resume();
        await new Promise((resolve) => response.on('end', resolve));
        expect(Date.now() - opened).toBeGreaterThan(1000);
        expect((await call('GET', '/api/stories/secret/events', { cookie })).status).toBe(401);
    });

    it('checks the content type and the origin of every mutation (CSRF)', async () => {
        await start({ allowedOrigins: ['https://stories.example.com'] });
        const cookie = await login(base, 'secret');
        const url = '/api/stories/secret/layout/timeline';
        const doc = { version: '', chapters: {}, triggers: {} };
        const put = (headers: Record<string, string>) =>
            fetch(base + url, { method: 'PUT', headers: { cookie, ...headers }, body: JSON.stringify(doc) });

        expect((await put({})).status).toBe(400);
        expect((await put({ 'content-type': 'text/plain' })).status).toBe(400);
        expect((await put({ 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(400);
        const json = { 'content-type': 'application/json; charset=utf-8' };
        expect((await put({ ...json, origin: 'https://evil.example' })).status).toBe(403);
        expect((await put({ ...json, origin: 'null' })).status).toBe(403);
        // an allowed origin, the server's own origin (the Vite proxy keeps Host), or no Origin (not a browser)
        const version = async () => (await call('GET', url, { cookie })).body.version as string;
        doc.version = await version();
        expect((await put({ ...json, origin: 'https://stories.example.com' })).status).toBe(200);
        doc.version = await version();
        expect((await put({ ...json, origin: base })).status).toBe(200);
        doc.version = await version();
        expect((await put(json)).status).toBe(200);

        // login and logout are mutations too
        const foreign = await tryLogin('secret', EXAMPLE_PASSWORD, { origin: 'https://evil.example' });
        expect(foreign.status).toBe(403);
        const plain = await fetch(`${base}/api/logout`, { method: 'POST' });
        expect(plain.status).toBe(400);
    });

    it('allows the dev ports by default', async () => {
        await start();
        for (const port of [8100, 8101, 8103]) {
            const res = await tryLogin('secret', EXAMPLE_PASSWORD, { origin: `http://localhost:${port}` });
            expect(res.status).toBe(204);
        }
        expect((await tryLogin('secret', EXAMPLE_PASSWORD, { origin: 'http://localhost:9999' })).status).toBe(403);
    });

    it('answers 429 after 10 wrong passwords per IP and story within 10 minutes', async () => {
        await start();
        for (let i = 0; i < 10; i++) expect((await tryLogin('secret', `wrong ${i}`)).status).toBe(401);
        const blocked = await tryLogin('secret', 'wrong again');
        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toBe('too_many_requests');
        // even the right password, until the window ends; other stories are not affected
        expect((await tryLogin('secret', EXAMPLE_PASSWORD)).status).toBe(429);
        expect((await tryLogin('example', EXAMPLE_PASSWORD)).status).toBe(204);
    }, 30_000);
});
