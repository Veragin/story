import http from 'node:http';
import { SchedulerRegistry } from '@nestjs/schedule';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRANT_TTL_MS, type TAuthOptions } from '../src/auth/authOptions';
import { LoginLimiter } from '../src/auth/LoginLimiter';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { hashToken, SESSION_PRUNE_JOB, SessionService } from '../src/auth/SessionService';
import { DatabaseService } from '../src/database/DatabaseService';
import { Session } from '../src/database/entities/Session';
import { SessionGrant } from '../src/database/entities/SessionGrant';
import { SessionGrantRepository } from '../src/database/repositories/SessionGrantRepository';
import { SessionRepository } from '../src/database/repositories/SessionRepository';
import { StoryRepository } from '../src/database/repositories/StoryRepository';
import { setupTestDatabase } from './helpers/database';
import { cookieOf, EXAMPLE_PASSWORD, login, requestJson, sleep } from './helpers/http';
import { openEventStream } from './helpers/sse';
import { storyFixture } from './helpers/storiesRoot';
import { createTestApp, readExampleStoryFile, seedStory, type TTestApp } from './helpers/testApp';

describe('password', () => {
    it('verifies the example story hash', async () => {
        const { password } = await readExampleStoryFile();
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
            `scrypt$1000$8$1$${salt}$${key}`,
            `scrypt$${2 ** 30}$8$1$${salt}$${key}`,
            `scrypt$16384$8$1$$${key}`,
            `scrypt$16384$8$1$${salt}$`,
        ]) {
            expect(await verifyPassword('x', stored)).toBe(false);
        }
        vi.restoreAllMocks();
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

describe('SessionService', () => {
    const dataSource = setupTestDatabase();
    const sessionsWith = async (options: Pick<TAuthOptions, 'grantTtlMs'> = { grantTtlMs: GRANT_TTL_MS }) => {
        const stories = new StoryRepository(dataSource);
        for (const id of ['alpha', 'beta']) await stories.insert(id, storyFixture());
        return new SessionService(
            new DatabaseService(dataSource),
            new SessionRepository(dataSource),
            new SessionGrantRepository(dataSource),
            options
        );
    };

    afterEach(() => {
        vi.useRealTimers();
    });

    it('grants a story for 24 h from the login, several stories per session', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const sessions = await sessionsWith();
        const { token, expiresAt } = await sessions.grant(undefined, 'alpha');
        expect(token).toMatch(/^[\w-]{43}$/);
        expect(expiresAt).toBe(Date.now() + GRANT_TTL_MS);

        vi.advanceTimersByTime(GRANT_TTL_MS / 2);
        expect((await sessions.grant(token, 'beta')).token).toBe(token);
        expect(await sessions.storyIds(token)).toEqual(['alpha', 'beta']);

        vi.advanceTimersByTime(GRANT_TTL_MS / 2 - 1);
        expect(await sessions.expiresAt(token, 'alpha')).toBe(expiresAt);
        vi.advanceTimersByTime(1);
        expect(await sessions.expiresAt(token, 'alpha')).toBeNull();
        expect(await sessions.storyIds(token)).toEqual(['beta']);

        vi.advanceTimersByTime(GRANT_TTL_MS / 2);
        expect(await sessions.storyIds(token)).toEqual([]);
        await sessions.prune();
        expect(await dataSource.manager.count(Session)).toBe(0);
    });

    it('stores only a SHA-256 hash of the token', async () => {
        const sessions = await sessionsWith();
        const { token } = await sessions.grant(undefined, 'alpha');
        const [row] = await dataSource.manager.find(Session);
        expect(row.tokenHash).toBe(hashToken(token));
        expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
        expect(JSON.stringify(await dataSource.query('SELECT * FROM `session`'))).not.toContain(token);
    });

    it('prunes expired grants and empty sessions, and starts a new session for a dead token', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const sessions = await sessionsWith({ grantTtlMs: 1000 });
        const { token } = await sessions.grant(undefined, 'alpha');
        const other = await sessions.grant(undefined, 'beta');
        vi.advanceTimersByTime(500);
        await sessions.grant(other.token, 'beta');
        vi.advanceTimersByTime(600);
        await sessions.prune();
        expect(await dataSource.manager.count(Session)).toBe(1);
        expect(await dataSource.manager.count(SessionGrant)).toBe(1);

        const fresh = await sessions.grant(token, 'alpha');
        expect(fresh.token).not.toBe(token);
        await sessions.revoke(fresh.token);
        expect(await sessions.expiresAt(fresh.token, 'alpha')).toBeNull();
        expect(await sessions.expiresAt(other.token, 'beta')).not.toBeNull();
    });

    it("drops a story's grants when the story is deleted", async () => {
        const sessions = await sessionsWith();
        const { token } = await sessions.grant(undefined, 'alpha');
        await sessions.grant(token, 'beta');
        await dataSource.query('DELETE FROM `story` WHERE `id` = ?', ['alpha']);
        expect(await sessions.storyIds(token)).toEqual(['beta']);
    });
});

describe('over HTTP', () => {
    let app: TTestApp | undefined;

    const start = async (auth: Partial<TAuthOptions> = {}) => {
        app = await createTestApp({ auth });
        await seedStory(app.app, 'example');
        await seedStory(app.app, 'secret', { name: 'Secret', public: false });
        return app.base;
    };

    afterEach(async () => {
        await app?.close();
        app = undefined;
    });

    const call = (base: string, method: string, url: string, headers: Record<string, string> = {}, body?: unknown) =>
        requestJson(base + url, method, { body, headers });

    const tryLogin = (base: string, storyId: string, password: string, headers: Record<string, string> = {}) =>
        call(base, 'POST', `/api/stories/${storyId}/login`, headers, { password });

    it('logs in with the password: 204, the cookie flags, then the session holds the grant', async () => {
        const base = await start();
        const wrong = await tryLogin(base, 'secret', 'nope');
        expect(wrong.status).toBe(401);
        expect(wrong.body).toEqual({ error: 'unauthorized', message: 'Wrong password' });
        expect(wrong.headers.get('set-cookie')).toBeNull();
        const missing = await tryLogin(base, 'nope', EXAMPLE_PASSWORD);
        expect([missing.status, missing.body]).toEqual([404, { error: 'not_found', message: 'No story "nope"' }]);
        const empty = await call(base, 'POST', '/api/stories/secret/login', {}, {});
        expect([empty.status, empty.body]).toEqual([
            400,
            { error: 'bad_request', message: 'Field "password" must be a non-empty string' },
        ]);

        const ok = await tryLogin(base, 'secret', EXAMPLE_PASSWORD);
        expect(ok.status).toBe(204);
        const setCookie = ok.headers.get('set-cookie') ?? '';
        expect(setCookie).toMatch(/^story_session=[\w-]{43}; /);
        expect(setCookie.split('; ').slice(1)).toEqual(['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=86400']);

        const cookie = cookieOf(ok);
        expect((await call(base, 'GET', '/api/session', { cookie })).body).toEqual({ storyIds: ['secret'] });
        expect((await call(base, 'GET', '/api/stories/secret/access', { cookie })).body).toEqual({
            canEdit: true,
            canPlay: true,
        });
    });

    it('adds Secure with cookieSecure (COOKIE_SECURE=1)', async () => {
        const base = await start({ cookieSecure: true });
        const ok = await tryLogin(base, 'secret', EXAMPLE_PASSWORD);
        expect(ok.headers.get('set-cookie')).toMatch(/; Secure$/);
        const out = await call(base, 'POST', '/api/logout', { cookie: cookieOf(ok) });
        expect(out.headers.get('set-cookie')).toMatch(/^story_session=; .*Max-Age=0; Secure$/);
    });

    it('keeps several grants in one cookie; session, access and logout', async () => {
        const base = await start();
        expect((await call(base, 'GET', '/api/session')).body).toEqual({ storyIds: [] });
        expect((await call(base, 'GET', '/api/stories/secret/access')).body).toEqual({
            canEdit: false,
            canPlay: false,
        });
        expect((await call(base, 'GET', '/api/stories/example/access')).body).toEqual({
            canEdit: false,
            canPlay: true,
        });
        const missing = await call(base, 'GET', '/api/stories/nope/access');
        expect([missing.status, missing.body.error]).toEqual([404, 'not_found']);

        const first = await login(base, 'secret');
        const cookie = await login(base, 'example', { cookie: first });
        expect(cookie).toBe(first);
        expect((await call(base, 'GET', '/api/session', { cookie })).body).toEqual({
            storyIds: ['example', 'secret'],
        });
        expect((await call(base, 'GET', '/api/stories/example/access', { cookie })).body).toEqual({
            canEdit: true,
            canPlay: true,
        });

        const out = await call(base, 'POST', '/api/logout', { cookie });
        expect(out.status).toBe(204);
        expect(out.headers.get('set-cookie')).toMatch(/^story_session=; .*Max-Age=0/);
        expect((await call(base, 'GET', '/api/session', { cookie })).body).toEqual({ storyIds: [] });
        expect((await call(base, 'GET', '/api/stories/secret/access', { cookie })).body).toEqual({
            canEdit: false,
            canPlay: false,
        });
    });

    it('gives every login without a live session its own cookie', async () => {
        const base = await start();
        const a = await login(base, 'example');
        const b = await login(base, 'example');
        expect(a).not.toBe(b);
        expect(await login(base, 'example', { cookie: 'story_session=forged' })).not.toBe('story_session=forged');
    });

    it("one user's logout leaves another user's session alone", async () => {
        const base = await start();
        const a = await login(base, 'secret');
        const b = await login(base, 'secret');
        expect((await call(base, 'POST', '/api/logout', { cookie: a })).status).toBe(204);
        expect((await call(base, 'GET', '/api/session', { cookie: a })).body).toEqual({ storyIds: [] });
        expect((await call(base, 'GET', '/api/session', { cookie: b })).body).toEqual({ storyIds: ['secret'] });
    });

    it('answers 429 after 10 wrong passwords per IP and story within 10 minutes', async () => {
        const base = await start();
        for (let i = 0; i < 10; i++) expect((await tryLogin(base, 'secret', `wrong ${i}`)).status).toBe(401);
        const blocked = await tryLogin(base, 'secret', 'wrong again');
        expect(blocked.status).toBe(429);
        expect(blocked.body).toEqual({
            error: 'too_many_requests',
            message: 'Too many wrong passwords, try again in a few minutes',
        });
        expect((await tryLogin(base, 'secret', EXAMPLE_PASSWORD)).status).toBe(429);
        expect((await tryLogin(base, 'example', EXAMPLE_PASSWORD)).status).toBe(204);
    }, 30_000);

    it('prunes on a @nestjs/schedule interval', async () => {
        await start();
        expect(app?.app.get(SchedulerRegistry).getInterval(SESSION_PRUNE_JOB)).toBeDefined();
    });

    it('keeps the session across an app restart on the same database', async () => {
        const base = await start();
        const cookie = await login(base, 'secret');
        await app?.close();
        app = await createTestApp({ truncate: false });
        const next = app.base;
        expect((await call(next, 'GET', '/api/session', { cookie })).body).toEqual({ storyIds: ['secret'] });
        expect((await call(next, 'GET', '/api/stories/secret/access', { cookie })).body).toEqual({
            canEdit: true,
            canPlay: true,
        });
        expect(await app.app.get(SessionRepository).count()).toBe(1);
    });

    it('refuses a grant once it expired', async () => {
        const base = await start({ grantTtlMs: 300 });
        const cookie = await login(base, 'secret');
        expect((await call(base, 'GET', '/api/stories/secret/access', { cookie })).body.canEdit).toBe(true);
        await sleep(400);
        expect((await call(base, 'GET', '/api/stories/secret/access', { cookie })).body.canEdit).toBe(false);
        expect((await call(base, 'GET', '/api/session', { cookie })).body).toEqual({ storyIds: [] });
    });

    it('closes the change feed when its grant expires', async () => {
        const base = await start({ grantTtlMs: 1500 });
        const cookie = await login(base, 'secret');
        const req = http.get(`${base}/api/stories/secret/events`, { headers: { cookie } });
        const response = await new Promise<http.IncomingMessage>((resolve) => req.on('response', resolve));
        expect(response.statusCode).toBe(200);
        const opened = Date.now();
        response.resume();
        await new Promise((resolve) => response.on('end', resolve));
        expect(Date.now() - opened).toBeGreaterThan(1000);
        expect((await call(base, 'GET', '/api/stories/secret/events', { cookie })).status).toBe(401);
    });

    it('keeps the change feed of a public story read without a grant open past any grant expiry', async () => {
        const base = await start({ grantTtlMs: 300 });
        const stream = await openEventStream(`${base}/api/stories/example/events`);
        expect(stream.response.statusCode).toBe(200);
        let ended = false;
        stream.response.on('end', () => (ended = true));
        await sleep(600);
        expect(ended).toBe(false);
        stream.close();
    });
});
