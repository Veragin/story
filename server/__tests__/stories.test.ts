import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectRoot } from '../src/project/ProjectRoot';
import { storyTsconfig } from '../src/stories/storyTsconfig';
import { login, QUIET_MS, requestJson, sleep, waitFor } from './helpers/http';
import { openEventStream } from './helpers/sse';
import { createTestApp, listenLocal, type TTestApp } from './helpers/testApp';

let app: TTestApp;
let base: string;
let alpha: ProjectRoot;
let beta: ProjectRoot;
let cookie: string;

const STALE_TSCONFIG = '{ "extends": "../../tsconfig.base.json", "include": ["data"] }\n';

const start = async (options: { idleMs?: number; lockBeta?: boolean } = {}) => {
    app = await createTestApp({
        stories: ['alpha', options.lockBeta ? { id: 'beta', public: false } : 'beta'],
        watch: true,
        batchMs: 50,
        idleMs: options.idleMs,
    });
    alpha = app.project('alpha');
    beta = app.project('beta');
    base = await listenLocal(app);
    cookie = await login(base, 'alpha');
    if (!options.lockBeta) cookie = await login(base, 'beta', { cookie });
};

afterEach(async () => {
    await app.close();
});

const call = (method: string, path: string, body?: unknown) =>
    requestJson(base + path, method, { body, headers: { cookie } });

const openStream = (storyId: string) => openEventStream(`${base}/api/stories/${storyId}/events`, { cookie });

describe('two stories', () => {
    beforeEach(() => start());

    it('keeps writes in their own story', async () => {
        const trigger = (await call('GET', '/api/stories/alpha/triggers/nobleHouseRobbery')).body;
        const betaBefore = await readFile(beta.abs('data/chapters/village/triggers.ts'), 'utf8');
        const res = await call('PUT', '/api/stories/alpha/triggers/nobleHouseRobbery', {
            version: trigger.version,
            description: 'Robbery in alpha',
        });
        expect(res.status).toBe(200);
        expect(await readFile(alpha.abs('data/chapters/village/triggers.ts'), 'utf8')).toContain('Robbery in alpha');
        expect(await readFile(beta.abs('data/chapters/village/triggers.ts'), 'utf8')).toBe(betaBefore);

        const inBeta = (await call('GET', '/api/stories/beta/triggers/nobleHouseRobbery')).body;
        expect(inBeta.description).toBe('Noble house robbery');
        expect(inBeta.version).toBe(trigger.version);
        expect(app.contexts.loadedIds().sort()).toEqual(['alpha', 'beta']);
    }, 60_000);

    it('keeps JSON store writes in their own story', async () => {
        const doc = { chapters: { village: { y: 1 } }, triggers: {} };
        expect((await call('PUT', '/api/stories/alpha/layout/timeline', { ...doc, version: '' })).status).toBe(200);
        expect((await call('GET', '/api/stories/alpha/layout/timeline')).body.chapters).toEqual(doc.chapters);
        expect((await call('GET', '/api/stories/beta/layout/timeline')).body).toEqual({
            chapters: {},
            triggers: {},
            version: '',
        });
        expect(app.contexts.loadedIds().sort()).toEqual(['alpha', 'beta']);
    });

    it('sends each story its own events only, for server writes and hand edits', async () => {
        const a = await openStream('alpha');
        const b = await openStream('beta');
        expect(a.response.statusCode).toBe(200);

        const doc = { chapters: { village: { y: 1 } }, triggers: {} };
        const put = await call('PUT', '/api/stories/alpha/layout/timeline', { ...doc, version: '' });
        expect(put.status).toBe(200);
        await waitFor(() => a.changes.length === 1);
        expect(a.changes[0]).toMatchObject({ kind: 'layout', id: 'timeline', op: 'created' });

        await appendFile(beta.abs('data/locations/village.location.ts'), '// edited in beta\n');
        await waitFor(() => b.changes.length === 1);
        expect(b.changes[0]).toMatchObject({ kind: 'entity', id: 'locations/village' });

        await sleep(QUIET_MS);
        expect(a.changes).toHaveLength(1);
        expect(b.changes).toHaveLength(1);
        a.close();
        b.close();
    });

    it('puts the story id in image urls', async () => {
        const res = await call('GET', '/api/stories/beta/images/passages/village-thomas-intro');
        expect(res.status).toBe(200);
        expect(res.body.url).toBe(`/api/stories/beta/images/passages/village-thomas-intro/png?v=${res.body.version}`);
        const png = await fetch(base + res.body.url);
        expect(png.status).toBe(200);
        expect(png.headers.get('content-type')).toBe('image/png');
    });

    it('loads nothing for an unknown story or an unknown path', async () => {
        expect((await call('GET', '/api/stories/alpha/nope')).status).toBe(404);
        expect((await call('GET', '/api/stories/unknown/layout/timeline')).status).toBe(404);
        expect((await call('GET', '/api/stories/unknown/events')).status).toBe(404);
        expect(app.contexts.loadedIds()).toEqual([]);
        expect((await call('GET', '/api/stories/alpha/info')).status).toBe(200);
        expect(app.contexts.loadedIds()).toEqual(['alpha']);
    });
});

describe('access check', () => {
    beforeEach(() => start({ lockBeta: true }));

    it('refuses a story without loading it, SSE included', async () => {
        const res = await call('GET', '/api/stories/beta/layout/timeline');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('unauthorized');
        expect((await call('GET', '/api/stories/beta/events')).status).toBe(401);
        expect((await call('GET', '/api/stories/alpha/layout/timeline')).status).toBe(200);
        expect(app.contexts.loadedIds()).toEqual(['alpha']);
    });
});

describe('story leases', () => {
    beforeEach(() => start());

    it('releases the lease of a plain request when it answers', async () => {
        expect((await call('GET', '/api/stories/alpha/layout/timeline')).status).toBe(200);
        expect(app.contexts.activeLeases('alpha')).toBe(0);
        expect((await call('PUT', '/api/stories/alpha/layout/timeline', { version: 'stale' })).status).toBe(409);
        expect(app.contexts.activeLeases('alpha')).toBe(0);
    });

    it('holds the lease of an event stream while it is open, and releases it when it closes', async () => {
        const stream = await openStream('alpha');
        expect(app.contexts.activeLeases('alpha')).toBe(1);
        const second = await openStream('alpha');
        expect(app.contexts.activeLeases('alpha')).toBe(2);
        stream.close();
        await waitFor(() => app.contexts.activeLeases('alpha') === 1);
        second.close();
        await waitFor(() => app.contexts.activeLeases('alpha') === 0);
        expect((await app.story('alpha')).bus.listenerCount).toBe(0);
    });

    it('closes open event streams when the app shuts down', async () => {
        const stream = await openStream('alpha');
        const ended = new Promise((resolve) => stream.response.on('close', resolve));
        await app.close();
        await ended;
        expect(app.contexts.loadedIds()).toEqual([]);
    });
});

describe('loading a story', () => {
    it('rewrites a stale story tsconfig', async () => {
        await start();
        await app.contexts.evict('alpha');
        await writeFile(alpha.abs('tsconfig.json'), STALE_TSCONFIG);
        expect((await call('GET', '/api/stories/alpha/layout/timeline')).status).toBe(200);
        expect(await readFile(alpha.abs('tsconfig.json'), 'utf8')).toBe(await storyTsconfig(alpha.root));
    });
});

describe('idle stories', () => {
    beforeEach(() => start({ idleMs: 60_000 }));

    it('are unloaded, except while a stream is open, and load again on the next request', async () => {
        const first = await app.story('alpha');
        await app.story('beta');
        const stream = await openStream('alpha');

        const later = Date.now() + 61_000;
        expect(await app.contexts.evictIdle(later)).toEqual(['beta']);
        expect(app.contexts.loadedIds()).toEqual(['alpha']);

        stream.close();
        await waitFor(() => first.bus.listenerCount === 0);
        expect(await app.contexts.evictIdle(Date.now())).toEqual([]);
        expect(await app.contexts.evictIdle(later)).toEqual(['alpha']);
        expect(app.contexts.loadedIds()).toEqual([]);
        expect(first.watching()).toBe(false);

        expect((await call('GET', '/api/stories/alpha/layout/timeline')).status).toBe(200);
        const again = await app.story('alpha');
        expect(again).not.toBe(first);
        expect(again.watching()).toBe(true);
    }, 60_000);
});
