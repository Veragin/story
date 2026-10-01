import { appendFile, readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TStoryRouteName } from '@story/visualizer-protocol';
import { createApp, type TApp } from '../src/app';
import { HttpError } from '../src/http/HttpError';
import type { ProjectRoot } from '../src/project/ProjectRoot';
import type { TStoryAccessRequest } from '../src/stories/access';
import { listenLocal, makeTempStories, openEventStream, QUIET_MS, requestJson, sleep, waitFor } from './helpers';

let app: TApp;
let base: string;
let alpha: ProjectRoot;
let beta: ProjectRoot;
let cleanup: () => Promise<void>;
let access: TStoryAccessRequest[];

const start = async (options: { idleMs?: number; lockBeta?: boolean } = {}) => {
    const temp = await makeTempStories(['alpha', 'beta']);
    cleanup = temp.cleanup;
    [alpha, beta] = temp.projects;
    access = [];
    app = await createApp({
        storiesRoot: temp.storiesRoot,
        watch: true,
        batchMs: 50,
        idleMs: options.idleMs,
        checkAccess: (request) => {
            access.push(request);
            if (options.lockBeta && request.storyId === 'beta') throw HttpError.unauthorized();
        },
    });
    base = await listenLocal(app);
};

afterEach(async () => {
    await app.close();
    await cleanup();
});

const call = (method: string, path: string, body?: unknown) => requestJson(base + path, method, { body });

const openStream = (storyId: string) => openEventStream(`${base}/api/stories/${storyId}/events`);

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

    it('asks the access check before loading a story, with the matched route', async () => {
        await call('GET', '/api/stories/alpha/project');
        await call('GET', '/api/stories/alpha/nope');
        await call('GET', '/api/stories/unknown/project');
        expect(access.map(({ storyId, route }) => [storyId, route])).toEqual([
            ['alpha', 'getProject' satisfies TStoryRouteName],
            ['alpha', null],
        ]);
    });
});

describe('access check', () => {
    beforeEach(() => start({ lockBeta: true }));

    it('refuses a story without loading it, SSE included', async () => {
        const res = await call('GET', '/api/stories/beta/project');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('unauthorized');
        expect((await call('GET', '/api/stories/beta/events')).status).toBe(401);
        expect((await call('GET', '/api/stories/alpha/project')).status).toBe(200);
        expect(app.contexts.loadedIds()).toEqual(['alpha']);
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

        expect((await call('GET', '/api/stories/alpha/project')).status).toBe(200);
        const again = await app.story('alpha');
        expect(again).not.toBe(first);
        expect(again.watching()).toBe(true);
    }, 60_000);
});
