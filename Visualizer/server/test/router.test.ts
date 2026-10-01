import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    buildGlobalPath,
    buildPath,
    GLOBAL_ROUTES,
    matchPath,
    splitStoryPath,
    STORY_ROUTES,
    storyApiPrefix,
    type TStoryRouteName,
} from '@story/visualizer-protocol';
import { createApp, type TApp } from '../src/app';
import type { TServerContext } from '../src/context';
import { HttpError } from '../src/http/HttpError';
import { ProjectRoot } from '../src/project/ProjectRoot';
import { StoryStore } from '../src/stories/StoryStore';
import { listenLocal, login, makeTempProject } from './helpers';

let app: TApp;
let story: TServerContext;
let base: string;
let storiesRoot: string;
let cleanup: () => Promise<void>;
let cookie: string;

beforeAll(async () => {
    const temp = await makeTempProject();
    cleanup = temp.cleanup;
    storiesRoot = temp.storiesRoot;
    app = await createApp({ storiesRoot: temp.storiesRoot, watch: false });
    story = await app.story('example');
    // overrides real routes to exercise the error mapping
    story.router.handle('getTrigger', ({ params }) => {
        switch (params.triggerId) {
            case 'stale':
                throw HttpError.stale({ triggerId: 'stale', version: 'v2' });
            case 'invalid':
                throw HttpError.invalid([{ file: 'data/x.ts', line: 1, column: 2, message: 'bad' }]);
            case 'referenced':
                throw HttpError.referenced([{ file: 'data/y.ts', line: 3 }]);
            case 'missing':
                throw HttpError.notFound('no such trigger');
            case 'boom':
                throw new Error('kaboom');
            default:
                throw HttpError.badRequest(`echo ${params.triggerId}`);
        }
    });
    story.router.handle('createTrigger', ({ params, body }) => ({ echo: { params, body } }) as never);
    story.router.handle('updateTrigger', ({ body }) => ({ echo: body }) as never);
    base = await listenLocal(app);
    cookie = await login(base);
});

afterAll(async () => {
    await app.close();
    await cleanup();
});

const call = async (method: string, path: string, body?: string) => {
    const res = await fetch(base + path, {
        method,
        body,
        headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};

describe('router', () => {
    it('answers GET /api/health', async () => {
        const { status, json } = await call('GET', '/api/health');
        expect(status).toBe(200);
        expect(json).toMatchObject({ ok: true, service: '@story/visualizer-server', watching: false });
        expect(json.storiesRoot).toBe(storiesRoot);
    });

    it('registers a handler for every protocol route', () => {
        expect(app.router.missing()).toEqual([]);
        expect(story.router.missing()).toEqual([]);
    });

    it('lists the stories without their password', async () => {
        const res = await fetch(base + '/api/stories');
        expect(res.status).toBe(200);
        const list = (await res.json()) as Record<string, unknown>[];
        expect(list).toEqual([
            expect.objectContaining({
                id: 'example',
                name: 'Example',
                public: true,
                mapSize: { width: 80, height: 60 },
            }),
        ]);
        expect(list[0]).not.toHaveProperty('password');
    });

    it('answers 404 for an unknown or malformed story id, before loading anything', async () => {
        const unknown = await call('GET', '/api/stories/nope/project');
        expect(unknown.status).toBe(404);
        expect(unknown.json).toMatchObject({ error: 'not_found', message: 'No story "nope"' });
        expect((await call('GET', '/api/stories/..%2F..%2Fetc/project')).status).toBe(404);
        expect((await call('GET', '/api/stories/Example/project')).status).toBe(404);
        expect(app.contexts.loadedIds()).toEqual(['example']);
    });

    it('answers the source routes (no 501 stubs)', async () => {
        const { status, json } = await call('GET', '/api/stories/example/chapters/village');
        expect(status).toBe(200);
        expect(json.chapterId).toBe('village');
    });

    it('answers 404 for unknown routes and wrong methods', async () => {
        expect((await call('GET', '/api/nope')).status).toBe(404);
        expect((await call('GET', '/api/stories/example/nope')).status).toBe(404);
        expect((await call('GET', '/api/stories/example')).status).toBe(404);
        expect((await call('PATCH', '/api/stories/example/chapters/village')).status).toBe(404);
        expect((await call('GET', '/other')).json.error).toBe('not_found');
    });

    it('maps HttpError to status and body', async () => {
        const stale = await call('GET', '/api/stories/example/triggers/stale');
        expect(stale.status).toBe(409);
        expect(stale.json).toMatchObject({ error: 'stale', current: { triggerId: 'stale', version: 'v2' } });

        const invalid = await call('GET', '/api/stories/example/triggers/invalid');
        expect(invalid.status).toBe(422);
        expect(invalid.json.diagnostics).toEqual([{ file: 'data/x.ts', line: 1, column: 2, message: 'bad' }]);

        const referenced = await call('GET', '/api/stories/example/triggers/referenced');
        expect(referenced.status).toBe(409);
        expect(referenced.json).toMatchObject({ error: 'referenced', references: [{ file: 'data/y.ts', line: 3 }] });

        expect((await call('GET', '/api/stories/example/triggers/missing')).status).toBe(404);
        expect((await call('GET', '/api/stories/example/triggers/x')).status).toBe(400);
    });

    it('turns other exceptions into 500 internal', async () => {
        const { status, json } = await call('GET', '/api/stories/example/triggers/boom');
        expect(status).toBe(500);
        expect(json).toMatchObject({ error: 'internal', message: 'kaboom' });
    });

    it('parses JSON bodies and decodes params; create routes answer 201', async () => {
        const { status, json } = await call(
            'POST',
            '/api/stories/example/chapters/my%20chapter/triggers',
            JSON.stringify({ triggerId: 't', name: 'T', time: '1.1. 0:00' })
        );
        expect(status).toBe(201);
        expect(json.echo).toEqual({
            params: { chapterId: 'my chapter' },
            body: { triggerId: 't', name: 'T', time: '1.1. 0:00' },
        });
    });

    it('rejects malformed and non-object bodies with 400', async () => {
        expect((await call('POST', '/api/stories/example/chapters/c/triggers', '{nope')).status).toBe(400);
        expect((await call('POST', '/api/stories/example/chapters/c/triggers', '[1]')).status).toBe(400);
        expect((await call('POST', '/api/stories/example/chapters/c/triggers')).status).toBe(400);
    });

    it('requires a string version on PUT and DELETE', async () => {
        const missing = await call('PUT', '/api/stories/example/triggers/t', JSON.stringify({ name: 'x' }));
        expect(missing.status).toBe(400);
        expect(String(missing.json.message)).toContain('version');
        const ok = await call('PUT', '/api/stories/example/triggers/t', JSON.stringify({ version: 'abc', name: 'x' }));
        expect(ok.status).toBe(200);
        expect(ok.json.echo).toEqual({ version: 'abc', name: 'x' });
        expect((await call('DELETE', '/api/stories/example/passages/a-b-c', '{}')).status).toBe(400);
    });
});

describe('protocol paths', () => {
    it('buildPath fills and encodes templates under the story prefix', () => {
        expect(buildPath('example', 'getChapter', { chapterId: 'village' })).toBe(
            '/api/stories/example/chapters/village'
        );
        expect(buildPath('example', 'removeChapterCharacter', { chapterId: 'a b', characterId: 'thomas' })).toBe(
            '/api/stories/example/chapters/a%20b/characters/thomas'
        );
        expect(buildPath('other', 'getEntity', { kind: 'npcs', id: 'franta' })).toBe(
            '/api/stories/other/entities/npcs/franta'
        );
        expect(buildGlobalPath('health', {})).toBe('/api/health');
        expect(buildGlobalPath('listStories', {})).toBe('/api/stories');
    });

    it('splitStoryPath + matchPath invert buildPath for every story route', () => {
        for (const route of Object.keys(STORY_ROUTES) as TStoryRouteName[]) {
            const template = STORY_ROUTES[route].path;
            const params = Object.fromEntries(
                [...template.matchAll(/:([A-Za-z]+)/g)].map(([, name]) => [name, `${name}-x y`])
            );
            const split = splitStoryPath(buildPath('my-story', route, params as never));
            expect(split).toEqual({ storyId: 'my-story', rest: expect.any(String) });
            expect(matchPath(template, split?.rest ?? '')).toEqual(params);
        }
        expect(matchPath('/chapters/:chapterId', '/chapters/')).toBeNull();
        expect(matchPath('/chapters/:chapterId', '/chapters/a/b')).toBeNull();
    });

    it('splitStoryPath only splits paths below a story', () => {
        expect(splitStoryPath('/api/stories')).toBeNull();
        expect(splitStoryPath('/api/stories/example')).toBeNull();
        expect(splitStoryPath('/api/health')).toBeNull();
        expect(splitStoryPath('/api/stories/example/')).toEqual({ storyId: 'example', rest: '/' });
        expect(splitStoryPath('/api/stories/%E0/project')).toBeNull();
    });

    it('story routes are relative, global routes are under /api', () => {
        expect(storyApiPrefix('example')).toBe('/api/stories/example');
        for (const def of Object.values(STORY_ROUTES)) {
            expect(def.path.startsWith('/')).toBe(true);
            expect(def.path.startsWith('/api')).toBe(false);
        }
        for (const def of Object.values(GLOBAL_ROUTES)) expect(def.path.startsWith('/api/')).toBe(true);
    });
});

describe('ProjectRoot', () => {
    it('takes its story id from the folder and refuses paths that escape it', () => {
        const root = new ProjectRoot('/tmp/stories/some-story');
        expect(root.storyId).toBe('some-story');
        expect(root.paths.map).toBe('/tmp/stories/some-story/data/locations/map.json');
        expect(root.rel(root.paths.chapterFile('village'))).toBe('data/chapters/village/village.chapter.ts');
        expect(() => root.abs('data/chapters', '../../../etc/passwd')).toThrow(/escapes/);
    });
});

describe('StoryStore', () => {
    it('reads STORIES_ROOT and refuses malformed ids', () => {
        const store = StoryStore.fromEnv({ STORIES_ROOT: '/tmp/some-stories' });
        expect(store.root).toBe('/tmp/some-stories');
        expect(store.dir('my-story')).toBe('/tmp/some-stories/my-story');
        for (const bad of ['', '..', '../x', 'A', '-x', 'a/b', 'x'.repeat(65)]) {
            expect(() => store.dir(bad)).toThrow(/story id/);
        }
    });
});
