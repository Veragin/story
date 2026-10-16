import { Body, Controller, Module } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpError } from '../src/common/HttpError';
import { MAX_JSON_BODY_BYTES } from '../src/common/body';
import { ProtocolRoute } from '../src/common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../src/common/RouteParams';
import { TriggersModule } from '../src/editor/triggers/TriggersModule';
import { ProjectRoot } from '../src/project/ProjectRoot';
import { StoryRepository } from '../src/database/repositories/StoryRepository';
import { StoryVersionConflictError } from '../src/stories/StoryVersionConflictError';
import { login, type TAny } from './helpers/http';
import { createTestApp, type TTestApp } from './helpers/testApp';

// takes the triggers' place, to exercise the error mapping and the body handling
@Controller()
class RouterProbe {
    @ProtocolRoute('getTrigger')
    getTrigger(@RouteParams() { triggerId }: THandlerParams<'getTrigger'>): never {
        switch (triggerId) {
            case 'stale':
                throw HttpError.stale({ triggerId: 'stale', version: 'v2' });
            case 'invalid':
                throw HttpError.invalid([{ file: 'data/x.ts', line: 1, column: 2, message: 'bad' }]);
            case 'referenced':
                throw HttpError.referenced([{ file: 'data/y.ts', line: 3 }]);
            case 'missing':
                throw HttpError.notFound('no such trigger');
            case 'conflict':
                throw new StoryVersionConflictError('example');
            case 'conflict-gone':
                throw new StoryVersionConflictError('gone');
            case 'boom':
                throw new Error('kaboom');
            default:
                throw HttpError.badRequest(`echo ${triggerId}`);
        }
    }

    @ProtocolRoute('createTrigger')
    createTrigger(@RouteParams() params: THandlerParams<'createTrigger'>, @Body() body: unknown) {
        return { echo: { params, body } };
    }

    @ProtocolRoute('updateTrigger')
    updateTrigger(@Body() body: unknown) {
        return { echo: body };
    }

    @ProtocolRoute('deleteTrigger')
    deleteTrigger(@Body() body: unknown) {
        return { echo: body };
    }
}

@Module({ controllers: [RouterProbe] })
class RouterProbeModule {}

let app: TTestApp;
let base: string;
let cookie: string;

beforeAll(async () => {
    app = await createTestApp({
        overrideModules: [{ replace: TriggersModule, with: RouterProbeModule }],
        stories: [
            { id: 'example', public: false },
            { id: 'open', public: true },
        ],
    });
    base = app.base;
    cookie = await login(base);
});

afterAll(async () => {
    await app.close();
});

const JSON_TYPE = 'application/json';

const call = async (method: string, path: string, body?: string, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, {
        method,
        body,
        headers: { cookie, ...(method === 'GET' ? {} : { 'content-type': JSON_TYPE }), ...headers },
    });
    const text = await res.text();
    const json: TAny = text ? JSON.parse(text) : undefined;
    return { status: res.status, headers: res.headers, text, json };
};

const TRIGGERS = '/api/stories/example/chapters/c/triggers';

describe('router: matching', () => {
    it('answers 404 for an unknown or malformed story id', async () => {
        const unknown = await call('GET', '/api/stories/nope/project');
        expect(unknown.status).toBe(404);
        expect(unknown.json).toEqual({ error: 'not_found', message: 'No story "nope"' });
        expect((await call('GET', '/api/stories/..%2F..%2Fetc/project')).status).toBe(404);
        expect((await call('GET', '/api/stories/Example/project')).status).toBe(404);
        expect(app.contexts.loadedIds()).toEqual([]);
    });

    it('answers the source routes', async () => {
        const { status, json } = await call('GET', '/api/stories/example/chapters/village');
        expect(status).toBe(200);
        expect(json.chapterId).toBe('village');
    });

    it('answers 404 for unknown routes and wrong methods', async () => {
        expect(await call('GET', '/api/nope')).toMatchObject({
            status: 404,
            json: { error: 'not_found', message: 'No route GET /api/nope' },
        });
        expect((await call('GET', '/api/stories/example/nope')).json).toEqual({
            error: 'not_found',
            message: 'No route GET /api/stories/example/nope',
        });
        expect((await call('GET', '/api/stories/example')).status).toBe(404);
        expect((await call('PATCH', '/api/stories/example/chapters/village')).status).toBe(404);
        expect((await call('GET', '/other?x=1')).json).toEqual({ error: 'not_found', message: 'No route GET /other' });
    });

    it('locks an unknown path below a story before saying there is no route', async () => {
        for (const storyId of ['example', 'open']) {
            const locked = await call('GET', `/api/stories/${storyId}/nope`, undefined, { cookie: '' });
            expect([storyId, locked.status, locked.json]).toEqual([
                storyId,
                401,
                { error: 'unauthorized', message: `Story "${storyId}" is locked: log in with its password first` },
            ]);
        }
        expect((await call('POST', '/api/stories/example/nope', '{}', { cookie: '' })).status).toBe(401);
        expect((await call('GET', '/api/stories/nope/nope', undefined, { cookie: '' })).json.message).toBe(
            'No story "nope"'
        );
    });
});

describe('router: errors', () => {
    it('maps HttpError to status and body', async () => {
        const stale = await call('GET', '/api/stories/example/triggers/stale');
        expect(stale.status).toBe(409);
        expect(stale.json).toEqual({
            error: 'stale',
            message: 'The resource changed on disk',
            current: { triggerId: 'stale', version: 'v2' },
        });

        const invalid = await call('GET', '/api/stories/example/triggers/invalid');
        expect(invalid.status).toBe(422);
        expect(invalid.json.diagnostics).toEqual([{ file: 'data/x.ts', line: 1, column: 2, message: 'bad' }]);

        const referenced = await call('GET', '/api/stories/example/triggers/referenced');
        expect(referenced.status).toBe(409);
        expect(referenced.json).toMatchObject({ error: 'referenced', references: [{ file: 'data/y.ts', line: 3 }] });

        expect((await call('GET', '/api/stories/example/triggers/missing')).status).toBe(404);
        expect(await call('GET', '/api/stories/example/triggers/x')).toMatchObject({
            status: 400,
            json: { error: 'bad_request', message: 'echo x' },
        });
    });

    it('turns other exceptions into 500 internal', async () => {
        const { status, json } = await call('GET', '/api/stories/example/triggers/boom');
        expect(status).toBe(500);
        expect(json).toEqual({ error: 'internal', message: 'kaboom' });
    });

    it('answers a story version conflict with 409 stale and the current story info', async () => {
        const current = await app.app.get(StoryRepository).readVersioned('example');
        const { status, json } = await call('GET', '/api/stories/example/triggers/conflict');
        expect(status).toBe(409);
        expect(json).toEqual({
            error: 'stale',
            message: 'The resource changed on disk',
            current: expect.objectContaining({ id: 'example', name: current?.file.name, version: current?.version }),
        });
        expect(json.current).not.toHaveProperty('password');
        const gone = await call('GET', '/api/stories/example/triggers/conflict-gone');
        expect(gone).toMatchObject({ status: 404, json: { error: 'not_found', message: 'No story "gone"' } });
    });
});

describe('router: bodies', () => {
    it('parses JSON bodies and decodes params; create routes answer 201', async () => {
        const body = { triggerId: 't', name: 'T', time: '1.1. 0:00' };
        const { status, json } = await call(
            'POST',
            '/api/stories/example/chapters/my%20chapter/triggers',
            JSON.stringify(body)
        );
        expect(status).toBe(201);
        expect(json.echo).toEqual({ params: { storyId: 'example', chapterId: 'my chapter' }, body });
    });

    it('rejects malformed and non-object bodies with 400', async () => {
        const malformed = await call('POST', TRIGGERS, '{nope');
        expect(malformed.status).toBe(400);
        expect(malformed.json.error).toBe('bad_request');
        expect(malformed.json.message).toMatch(/^Malformed JSON body: /);
        for (const body of ['[1]', '"x"', 'null', '', '   ', undefined]) {
            expect([body, await call('POST', TRIGGERS, body)]).toMatchObject([
                body,
                { status: 400, json: { error: 'bad_request', message: 'Expected a JSON object body' } },
            ]);
        }
    });

    it('requires a string version on PUT and DELETE', async () => {
        const missing = await call('PUT', '/api/stories/example/triggers/t', JSON.stringify({ name: 'x' }));
        expect(missing.status).toBe(400);
        expect(missing.json.message).toBe('Field "version" must be a string (the version the change is based on)');
        const numeric = await call('PUT', '/api/stories/example/triggers/t', JSON.stringify({ version: 1 }));
        expect(numeric.status).toBe(400);
        const ok = await call('PUT', '/api/stories/example/triggers/t', JSON.stringify({ version: 'abc', name: 'x' }));
        expect(ok.status).toBe(200);
        expect(ok.json.echo).toEqual({ version: 'abc', name: 'x' });
        expect((await call('DELETE', '/api/stories/example/triggers/a-b-c', '{}')).status).toBe(400);
        const deleted = await call('DELETE', '/api/stories/example/triggers/a-b-c', '{"version":"1"}');
        expect(deleted).toMatchObject({ status: 200, json: { echo: { version: '1' } } });
    });

    it('takes JSON bodies up to 20 MB', async () => {
        const big = JSON.stringify({ triggerId: 't', pad: 'x'.repeat(5 * 1024 * 1024) });
        expect((await call('POST', TRIGGERS, big)).status).toBe(201);
        const tooBig = await call('POST', TRIGGERS, JSON.stringify({ pad: 'x'.repeat(MAX_JSON_BODY_BYTES) }));
        expect(tooBig).toMatchObject({
            status: 400,
            json: { error: 'bad_request', message: `Request body larger than ${MAX_JSON_BODY_BYTES} bytes` },
        });
    });

    it('checks origin and access before it reads the body', async () => {
        const foreign = await call('POST', TRIGGERS, '{nope', { origin: 'https://evil.example' });
        expect(foreign.status).toBe(403);
        const locked = await call('POST', TRIGGERS, '{nope', { cookie: '' });
        expect(locked.status).toBe(401);
        const unknown = await call('PUT', '/api/stories/nope/triggers/t', '[', { cookie: '' });
        expect(unknown.status).toBe(404);
    });
});

describe('router: response headers', () => {
    it('sends JSON with no-store, a trailing newline, no ETag and no X-Powered-By', async () => {
        const res = await call('GET', '/api/stories/example/project');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(res.headers.get('etag')).toBeNull();
        expect(res.headers.get('x-powered-by')).toBeNull();
        expect(res.text.endsWith('}\n')).toBe(true);
    });

    it('sets the same headers on 201, 204 and errors', async () => {
        const created = await call('POST', TRIGGERS, '{}');
        expect([created.status, created.headers.get('cache-control')]).toEqual([201, 'no-store']);
        const logout = await call('POST', '/api/logout', '', { cookie: '' });
        expect([logout.status, logout.headers.get('cache-control'), logout.text]).toEqual([204, 'no-store', '']);
        for (const path of ['/api/nope', '/api/stories/example/triggers/boom']) {
            const error = await call('GET', path);
            expect(error.headers.get('cache-control')).toBe('no-store');
            expect(error.headers.get('content-type')).toBe('application/json; charset=utf-8');
            expect(error.headers.get('x-powered-by')).toBeNull();
            expect(error.text.endsWith('\n')).toBe(true);
        }
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
