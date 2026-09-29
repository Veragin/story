import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_STORY_ZIP_BYTES, STORY_LIMITS } from '@story/visualizer-protocol';
import { createApp, type TApp } from '../src/app';
import { ProjectRoot, REPO_ROOT } from '../src/project/ProjectRoot';
import { SourceProject } from '../src/project/SourceProject';
import { diagnoseProject } from '../src/project/validate';
import { slugify } from '../src/stories/storyFolders';
import { STORY_FILE } from '../src/stories/StoryStore';
import { EXAMPLE_PASSWORD, login, makeTempStories } from './helpers';
import { storyProblems } from './sourceHelpers';

/**
 * The stories API (multiple stories, phase 5): create from the template, list, edit the info,
 * export and import. Every story is made in a temp `STORIES_ROOT`, never in `stories/`.
 */

let app: TApp;
let base: string;
let storiesRoot: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
    const temp = await makeTempStories(['example']);
    storiesRoot = temp.storiesRoot;
    cleanup = temp.cleanup;
    app = await createApp({ storiesRoot, watch: false });
    base = `http://127.0.0.1:${await app.listen(0, '127.0.0.1')}`;
});

afterEach(async () => {
    await app.close();
    await cleanup();
});

type TCall = { status: number; headers: Headers; body: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const call = async (method: string, url: string, { body, cookie }: { body?: unknown; cookie?: string } = {}) => {
    const res = await fetch(base + url, {
        method,
        headers: {
            ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
            ...(cookie ? { cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : undefined } as TCall;
};

const NEW_STORY = {
    name: 'My Story',
    author: 'Tester',
    password: 'secret-1',
    description: 'A test story.',
    mapSize: { width: 20, height: 10 },
    public: false,
};

/** Create a story; returns its id and the creator's cookie. */
const create = async (overrides: Record<string, unknown> = {}) => {
    const res = await call('POST', '/api/stories', { body: { ...NEW_STORY, ...overrides } });
    expect(res.status).toBe(201);
    return { id: res.body.id as string, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0], res };
};

const exportZip = async (storyId: string, cookie: string) => {
    const res = await fetch(`${base}/api/stories/${storyId}/export`, { headers: { cookie } });
    expect(res.status).toBe(200);
    return { res, bytes: new Uint8Array(await res.arrayBuffer()) };
};

const importZip = async (id: string, zip: Uint8Array, contentType = 'application/zip') => {
    const res = await fetch(`${base}/api/stories/import?id=${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'content-type': contentType },
        body: new Uint8Array(zip),
    });
    return { status: res.status, body: await res.json() } as TCall;
};

/** What the stories root holds: story folders and any temp folder left behind. */
const rootEntries = async () => (await readdir(storiesRoot)).sort();

describe('slugify', () => {
    it('makes a story id from a name', () => {
        expect(slugify('My Story')).toBe('my-story');
        expect(slugify('  Příběh o Ježkovi!  ')).toBe('pribeh-o-jezkovi');
        expect(slugify('!!!')).toBe('story');
        expect(slugify('故事')).toBe('story');
        expect(slugify('x'.repeat(80))).toBe('x'.repeat(64));
    });
});

describe('create', () => {
    it('creates from the template, logs the creator in, and suffixes a taken id', async () => {
        const { id, cookie, res } = await create();
        expect(id).toBe('my-story');
        expect(res.body).toEqual({ id, ...NEW_STORY, password: undefined });
        expect(res.headers.get('set-cookie')).toMatch(/^story_session=[\w-]{43}; HttpOnly/);

        const dir = path.join(storiesRoot, id);
        const file = JSON.parse(await readFile(path.join(dir, STORY_FILE), 'utf8'));
        expect(file.password).toMatch(/^scrypt\$/);
        expect(JSON.stringify(file)).not.toContain(NEW_STORY.password);
        for (const f of ['tsconfig.json', 'data/register.ts', 'types/index.ts']) {
            expect((await stat(path.join(dir, f))).isFile()).toBe(true);
        }

        // the creator's cookie opens it; the map is an empty map of mapSize
        const map = await call('GET', `/api/stories/${id}/maps/global`, { cookie });
        expect(map.status).toBe(200);
        expect(map.body).toMatchObject({ width: 20, height: 10, locations: {} });
        expect(map.body.version).not.toBe('');
        const project = await call('GET', `/api/stories/${id}/project`, { cookie });
        expect(project.body.chapters.map((c: { id: string }) => c.id)).toEqual(['start']);
        expect((await call('GET', `/api/stories/${id}/project`)).status).toBe(401);

        const second = await create();
        expect(second.id).toBe('my-story-2');
        expect(await rootEntries()).toEqual(['example', 'my-story', 'my-story-2']);
    });

    it('type-checks with no diagnostics, in memory and with tsc through its own tsconfig.json', async () => {
        const { id } = await create();
        const dir = path.join(storiesRoot, id);
        const sp = new SourceProject(new ProjectRoot(dir, id));
        await sp.run(() => undefined);
        expect(diagnoseProject(sp)).toEqual([]);
        expect(await storyProblems(dir)).toEqual([]);

        const tsc = path.join(REPO_ROOT, 'node_modules/typescript/bin/tsc');
        const out = await promisify(execFile)(process.execPath, [
            tsc,
            '--noEmit',
            '-p',
            path.join(dir, 'tsconfig.json'),
        ])
            .then(({ stdout }) => stdout)
            .catch((e: { stdout?: string }) => e.stdout ?? String(e));
        expect(out).toBe('');
    }, 60_000);

    it('validates the body', async () => {
        const bad = [
            { name: '' },
            { name: '   ' },
            { name: 'x'.repeat(STORY_LIMITS.nameMaxLength + 1) },
            { name: 42 },
            { password: 'short' },
            { password: undefined },
            { mapSize: { width: 0, height: 10 } },
            { mapSize: { width: 20, height: STORY_LIMITS.mapSizeMax + 1 } },
            { mapSize: { width: 1.5, height: 10 } },
            { mapSize: undefined },
            { public: 'yes' },
            { description: 'x'.repeat(STORY_LIMITS.descriptionMaxLength + 1) },
        ];
        for (const overrides of bad) {
            const res = await call('POST', '/api/stories', { body: { ...NEW_STORY, ...overrides } });
            expect([overrides, res.status, res.body.error]).toEqual([overrides, 400, 'bad_request']);
        }
        expect(await rootEntries()).toEqual(['example']);

        const minimal = await call('POST', '/api/stories', {
            body: { name: ' Minimal ', password: 'secret-1', mapSize: { width: 1, height: 1 } },
        });
        expect(minimal.status).toBe(201);
        expect(minimal.body).toMatchObject({
            id: 'minimal',
            name: 'Minimal',
            author: '',
            description: '',
            public: false,
        });
    });
});

describe('list and info', () => {
    it('lists by name with the unlocked flag; edits the info, versioned', async () => {
        const { id, cookie } = await create({ name: 'Alpha' });
        const listed = await call('GET', '/api/stories', { cookie });
        expect(listed.body.map((s: { id: string; unlocked: boolean }) => [s.id, s.unlocked])).toEqual([
            ['alpha', true],
            ['example', false],
        ]);
        expect(listed.body[0].password).toBeUndefined();
        expect((await call('GET', '/api/stories')).body.every((s: { unlocked: boolean }) => !s.unlocked)).toBe(true);

        expect((await call('GET', `/api/stories/${id}/info`)).status).toBe(401);
        const info = await call('GET', `/api/stories/${id}/info`, { cookie });
        expect(info.status).toBe(200);
        expect(info.body).toMatchObject({ id, name: 'Alpha', mapSize: NEW_STORY.mapSize });
        expect(info.body.version).toMatch(/^[0-9a-f]{16}$/);
        expect(info.body.password).toBeUndefined();

        const url = `/api/stories/${id}/info`;
        const put = (body: Record<string, unknown>) => call('PUT', url, { cookie, body });
        expect((await put({ version: info.body.version, mapSize: { width: 30, height: 10 } })).status).toBe(400);
        expect((await put({ version: info.body.version, password: 'short' })).status).toBe(400);
        expect((await put({ version: info.body.version, name: '' })).status).toBe(400);
        expect((await put({ version: info.body.version, color: 'red' })).status).toBe(400);

        // the whole DTO sent back, edited: mapSize and id unchanged are fine
        const edited = await put({ ...info.body, name: 'Alpha 2', public: true, password: 'new-password' });
        expect(edited.status).toBe(200);
        expect(edited.body).toMatchObject({ id, name: 'Alpha 2', public: true, author: 'Tester' });
        expect(edited.body.version).not.toBe(info.body.version);
        expect(await rootEntries()).toContain('alpha'); // the id never changes (plan D3)

        const stale = await put({ version: info.body.version, name: 'Lost' });
        expect(stale.status).toBe(409);
        expect(stale.body).toMatchObject({ error: 'stale', current: { name: 'Alpha 2' } });

        await expect(login(base, id, { password: NEW_STORY.password })).rejects.toThrow('401');
        expect(await login(base, id, { password: 'new-password' })).toMatch(/^story_session=/);

        // an empty password keeps the current one
        const kept = await put({ version: edited.body.version, password: '', description: 'Changed' });
        expect(kept.status).toBe(200);
        expect(await login(base, id, { password: 'new-password' })).toMatch(/^story_session=/);
    });
});

describe('export and import', () => {
    it('round-trips byte-identically, keeping the password', async () => {
        const { id, cookie } = await create();
        const { res, bytes } = await exportZip(id, cookie);
        expect(res.headers.get('content-type')).toBe('application/zip');
        expect(res.headers.get('content-disposition')).toBe(`attachment; filename="${id}.zip"`);
        expect((await fetch(`${base}/api/stories/${id}/export`)).status).toBe(401);

        const imported = await importZip('copy', bytes);
        expect(imported.status).toBe(201);
        expect(imported.body).toMatchObject({ id: 'copy', name: NEW_STORY.name });
        const copyCookie = await login(base, 'copy', { password: NEW_STORY.password });
        expect(Buffer.from((await exportZip('copy', copyCookie)).bytes).equals(bytes)).toBe(true);
        expect(await readFile(path.join(storiesRoot, 'copy', STORY_FILE), 'utf8')).toBe(
            await readFile(path.join(storiesRoot, id, STORY_FILE), 'utf8')
        );

        // the example has art (binary) and extra files; they round-trip too. Only its hand-written
        // tsconfig.json is replaced: an import writes one for the story's folder
        const exampleCookie = await login(base, 'example', { password: EXAMPLE_PASSWORD });
        const example = unzipSync((await exportZip('example', exampleCookie)).bytes);
        expect(Object.keys(example)).toContain('data/chapters/village/thomas.passages/intro.png');
        expect((await importZip('example-copy', zipSync(example))).status).toBe(201);
        const copyOfExample = await login(base, 'example-copy', { password: EXAMPLE_PASSWORD });
        const copied = unzipSync((await exportZip('example-copy', copyOfExample)).bytes);
        expect(Object.keys(copied)).toEqual(Object.keys(example));
        for (const name of Object.keys(example)) {
            if (name !== 'tsconfig.json')
                expect([name, Buffer.from(copied[name]).equals(example[name])]).toEqual([name, true]);
        }
        expect((await call('GET', '/api/stories/example-copy/project', { cookie: copyOfExample })).status).toBe(200);

        // the id is taken (plan D8), or not an id; the content type is the zip's
        expect(await importZip('copy', bytes)).toMatchObject({ status: 409, body: { error: 'exists' } });
        expect(await importZip('example', bytes)).toMatchObject({ status: 409, body: { error: 'exists' } });
        expect((await importZip('Bad Id', bytes)).status).toBe(400);
        expect((await importZip('', bytes)).status).toBe(400);
        expect((await importZip('other', bytes, 'application/json')).status).toBe(400);
        expect(await rootEntries()).toEqual(['copy', 'example', 'example-copy', 'my-story']);
    }, 60_000);

    it('refuses bad zips and leaves nothing behind', async () => {
        const { id, cookie } = await create();
        const good = (await exportZip(id, cookie)).bytes;
        const storyJson = await readFile(path.join(storiesRoot, id, STORY_FILE));
        const ok = { [STORY_FILE]: new Uint8Array(storyJson), 'data/index.ts': new Uint8Array([1]) };
        const zip = (files: Zippable) => zipSync(files);
        const text = (s: string) => new TextEncoder().encode(s);

        const bad: [string, Uint8Array][] = [
            ['zip-slip', zip({ ...ok, '../evil.ts': text('x') })],
            ['zip-slip inside', zip({ ...ok, 'data/../../evil.ts': text('x') })],
            ['absolute', zip({ ...ok, '/etc/evil': text('x') })],
            ['backslash', zip({ ...ok, 'data\\..\\evil.ts': text('x') })],
            ['other top-level', zip({ ...ok, 'evil.txt': text('x') })],
            ['file where a folder goes', zip({ ...ok, data: text('x') })],
            ['symlink', zip({ ...ok, 'data/link.ts': [text('/etc/passwd'), { os: 3, attrs: 0o120777 << 16 }] })],
            ['no story.json', zip({ 'data/index.ts': text('x') })],
            ['story.json not JSON', zip({ ...ok, [STORY_FILE]: text('{') })],
            ['story.json invalid', zip({ ...ok, [STORY_FILE]: text('{"name": 1}') })],
            [
                'unusable password hash',
                zip({ ...ok, [STORY_FILE]: text(JSON.stringify({ ...JSON.parse(String(storyJson)), password: 'x' })) }),
            ],
            ['not a zip', text('hello')],
            ['truncated', good.subarray(0, good.length - 30)],
        ];
        for (const [what, bytes] of bad) {
            const res = await importZip('imported', bytes);
            expect([what, res.status, res.body.error]).toEqual([what, 400, 'bad_request']);
        }

        const tooLarge = new Uint8Array(MAX_STORY_ZIP_BYTES + 1);
        expect((await importZip('imported', tooLarge)).status).toBe(400);

        expect(await rootEntries()).toEqual(['example', id]);
        expect((await importZip('imported', zip(ok))).status).toBe(201);
    }, 60_000);
});
