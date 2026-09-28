import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildPath, matchPath, ROUTES, type TRouteName } from '@story/visualizer-protocol';
import { createApp, type TApp } from '../src/app';
import { HttpError } from '../src/http/HttpError';
import { ProjectRoot } from '../src/project/ProjectRoot';
import { makeTempProject } from './helpers';

let app: TApp;
let base: string;
let cleanup: () => Promise<void>;

beforeAll(async () => {
    const temp = await makeTempProject();
    cleanup = temp.cleanup;
    app = await createApp({ project: temp.project, watch: false });
    // Test-only handlers on real protocol routes, to exercise the error mapping.
    app.router.handle('getTrigger', ({ params }) => {
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
    app.router.handle('createTrigger', ({ params, body }) => ({ echo: { params, body } }) as never);
    app.router.handle('updateTrigger', ({ body }) => ({ echo: body }) as never);
    const port = await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
    await app.close();
    await cleanup();
});

const call = async (method: string, path: string, body?: string) => {
    const res = await fetch(base + path, {
        method,
        body,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};

describe('router', () => {
    it('answers GET /api/health', async () => {
        const { status, json } = await call('GET', '/api/health');
        expect(status).toBe(200);
        expect(json).toMatchObject({ ok: true, service: '@story/visualizer-server', watching: false });
        expect(json.root).toBe(app.project.root);
    });

    it('registers a handler for every protocol route', () => {
        expect(app.router.missing()).toEqual([]);
    });

    it('has no 501 stubs left since WP2 (the source routes answer)', async () => {
        const { status, json } = await call('GET', '/api/chapters/village');
        expect(status).toBe(200);
        expect(json.chapterId).toBe('village');
    });

    it('answers 404 for unknown routes and wrong methods', async () => {
        expect((await call('GET', '/api/nope')).status).toBe(404);
        expect((await call('PATCH', '/api/chapters/village')).status).toBe(404);
        expect((await call('GET', '/other')).json.error).toBe('not_found');
    });

    it('maps HttpError to status and body', async () => {
        const stale = await call('GET', '/api/triggers/stale');
        expect(stale.status).toBe(409);
        expect(stale.json).toMatchObject({ error: 'stale', current: { triggerId: 'stale', version: 'v2' } });

        const invalid = await call('GET', '/api/triggers/invalid');
        expect(invalid.status).toBe(422);
        expect(invalid.json.diagnostics).toEqual([{ file: 'data/x.ts', line: 1, column: 2, message: 'bad' }]);

        const referenced = await call('GET', '/api/triggers/referenced');
        expect(referenced.status).toBe(409);
        expect(referenced.json).toMatchObject({ error: 'referenced', references: [{ file: 'data/y.ts', line: 3 }] });

        expect((await call('GET', '/api/triggers/missing')).status).toBe(404);
        expect((await call('GET', '/api/triggers/x')).status).toBe(400);
    });

    it('turns other exceptions into 500 internal', async () => {
        const { status, json } = await call('GET', '/api/triggers/boom');
        expect(status).toBe(500);
        expect(json).toMatchObject({ error: 'internal', message: 'kaboom' });
    });

    it('parses JSON bodies and decodes params; create routes answer 201', async () => {
        const { status, json } = await call(
            'POST',
            '/api/chapters/my%20chapter/triggers',
            JSON.stringify({ triggerId: 't', name: 'T', time: '1.1. 0:00' })
        );
        expect(status).toBe(201);
        expect(json.echo).toEqual({
            params: { chapterId: 'my chapter' },
            body: { triggerId: 't', name: 'T', time: '1.1. 0:00' },
        });
    });

    it('rejects malformed and non-object bodies with 400', async () => {
        expect((await call('POST', '/api/chapters/c/triggers', '{nope')).status).toBe(400);
        expect((await call('POST', '/api/chapters/c/triggers', '[1]')).status).toBe(400);
        expect((await call('POST', '/api/chapters/c/triggers')).status).toBe(400);
    });

    it('requires a string version on PUT and DELETE', async () => {
        const missing = await call('PUT', '/api/triggers/t', JSON.stringify({ name: 'x' }));
        expect(missing.status).toBe(400);
        expect(String(missing.json.message)).toContain('version');
        const ok = await call('PUT', '/api/triggers/t', JSON.stringify({ version: 'abc', name: 'x' }));
        expect(ok.status).toBe(200);
        expect(ok.json.echo).toEqual({ version: 'abc', name: 'x' });
        expect((await call('DELETE', '/api/passages/a-b-c', '{}')).status).toBe(400);
    });
});

describe('protocol paths', () => {
    it('buildPath fills and encodes templates', () => {
        expect(buildPath('getChapter', { chapterId: 'village' })).toBe('/api/chapters/village');
        expect(buildPath('removeChapterCharacter', { chapterId: 'a b', characterId: 'thomas' })).toBe(
            '/api/chapters/a%20b/characters/thomas'
        );
        expect(buildPath('getEntity', { kind: 'npcs', id: 'franta' })).toBe('/api/entities/npcs/franta');
        expect(buildPath('health', {})).toBe('/api/health');
    });

    it('matchPath inverts buildPath for every route', () => {
        for (const route of Object.keys(ROUTES) as TRouteName[]) {
            const template = ROUTES[route].path;
            const params = Object.fromEntries(
                [...template.matchAll(/:([A-Za-z]+)/g)].map(([, name]) => [name, `${name}-x y`])
            );
            const built = buildPath(route, params as never);
            expect(matchPath(template, built)).toEqual(params);
        }
        expect(matchPath('/api/chapters/:chapterId', '/api/chapters/')).toBeNull();
        expect(matchPath('/api/chapters/:chapterId', '/api/chapters/a/b')).toBeNull();
    });

    it('every route is under /api', () => {
        for (const def of Object.values(ROUTES)) expect(def.path.startsWith('/api/')).toBe(true);
    });
});

describe('ProjectRoot', () => {
    it('reads STORY_ROOT and refuses paths that escape it', () => {
        const root = ProjectRoot.fromEnv({ STORY_ROOT: '/tmp/some-story' });
        expect(root.root).toBe('/tmp/some-story');
        expect(root.paths.map).toBe('/tmp/some-story/data/locations/map.json');
        expect(root.rel(root.paths.chapterFile('village'))).toBe('data/chapters/village/village.chapter.ts');
        expect(() => root.abs('data/chapters', '../../../etc/passwd')).toThrow(/escapes/);
    });
});
