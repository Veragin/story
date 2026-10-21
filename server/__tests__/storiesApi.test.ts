import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_STORY_ZIP_BYTES, STORY_LIMITS, storyImportForm, type TImportStoryBody } from '@story/protocol';
import { REPO_ROOT } from '../src/config/env';
import { createDefaultMap, decodeMapFile, encodeMapFile, MAP_FILE } from '../src/json/mapFile';
import { ProjectRoot } from '../src/project/ProjectRoot';
import { SourceProject } from '../src/project/SourceProject';
import { diagnoseProject } from '../src/project/validate';
import { STORY_FILE } from '../src/stories/storyFile';
import { slugify } from '../src/stories/StoryFolders';
import { StoryRepository } from '../src/database/repositories/StoryRepository';
import { storyTsconfig } from '../src/stories/storyTsconfig';
import { cookieOf, EXAMPLE_PASSWORD, login, requestJson, type TJsonResponse } from './helpers/http';
import { storyProblems } from './helpers/sourceHelpers';
import { copyExampleStory } from './helpers/storiesRoot';
import { createTestApp, seedStory, type TTestApp } from './helpers/testApp';

let app: TTestApp;
let base: string;
let storiesRoot: string;

beforeEach(async () => {
    app = await createTestApp();
    base = app.base;
    storiesRoot = app.storiesRoot;
    await copyExampleStory(storiesRoot, 'example');
    await seedStory(app.app, 'example');
});

afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
});

const call = (method: string, url: string, { body, cookie }: { body?: unknown; cookie?: string } = {}) =>
    requestJson(base + url, method, { body, headers: cookie ? { cookie } : {} });

const NEW_STORY = {
    name: 'My Story',
    author: 'Tester',
    password: 'secret-1',
    description: 'A test story.',
    mapSize: { width: 20, height: 10 },
    public: false,
};

const IMPORTED: TImportStoryBody = {
    name: 'Copy',
    author: 'Importer',
    password: 'copy-secret',
    description: 'Imported.',
    public: false,
};

const create = async (overrides: Record<string, unknown> = {}) => {
    const res = await call('POST', '/api/stories', { body: { ...NEW_STORY, ...overrides } });
    expect(res.status).toBe(201);
    return { id: String(res.body.id), cookie: cookieOf(res), res };
};

const exportZip = async (storyId: string, cookie?: string) => {
    const res = await fetch(`${base}/api/stories/${storyId}/export`, { headers: cookie ? { cookie } : {} });
    expect(res.status).toBe(200);
    return { res, bytes: new Uint8Array(await res.arrayBuffer()) };
};

const send = async (form: FormData, headers: Record<string, string> = {}): Promise<TJsonResponse> => {
    const res = await fetch(`${base}/api/stories/import`, { method: 'POST', body: form, headers });
    return { status: res.status, headers: res.headers, body: await res.json() };
};

const importZip = (zip: Uint8Array, overrides: Partial<TImportStoryBody> = {}) =>
    send(storyImportForm(new Blob([new Uint8Array(zip)]), { ...IMPORTED, ...overrides }));

const rootEntries = async () => (await readdir(storiesRoot)).sort();

const text = (s: string) => new TextEncoder().encode(s);

const mapSizeOnDisk = async (storyId: string) => {
    const map = decodeMapFile(JSON.parse(await readFile(path.join(storiesRoot, storyId, MAP_FILE), 'utf8')));
    return { width: map.width, height: map.height };
};

const contentOf = (zip: Uint8Array) => {
    const files = unzipSync(zip);
    delete files['tsconfig.json'];
    return files;
};

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
        for (const f of ['tsconfig.json', 'data/register.ts', 'types/index.ts', MAP_FILE]) {
            expect((await stat(path.join(dir, f))).isFile()).toBe(true);
        }
        expect(await readdir(dir)).not.toContain(STORY_FILE);
        expect(await mapSizeOnDisk(id)).toEqual(NEW_STORY.mapSize);

        const row = await app.app.get(StoryRepository).read(id);
        expect(row?.password).toMatch(/^scrypt\$/);
        expect(JSON.stringify(row)).not.toContain(NEW_STORY.password);

        expect((await call('GET', `/api/stories/${id}/info`, { cookie })).status).toBe(200);
        expect((await call('GET', `/api/stories/${id}/info`)).status).toBe(401);
        const project = await call('GET', `/api/stories/${id}/project`, { cookie });
        expect(project.body.chapters.map((c: { id: string }) => c.id)).toEqual(['start']);
        expect((await call('GET', `/api/stories/${id}/project`)).status).toBe(401);

        const second = await create();
        expect(second.id).toBe('my-story-2');
        expect(await rootEntries()).toEqual(['example', 'my-story', 'my-story-2']);
    });

    it('type-checks with no diagnostics in memory', async () => {
        const { id } = await create();
        const dir = path.join(storiesRoot, id);
        const sp = new SourceProject(new ProjectRoot(dir, id));
        await sp.run(() => undefined);
        expect(diagnoseProject(sp)).toEqual([]);
        expect(await storyProblems(dir)).toEqual([]);
    }, 60_000);

    it('type-checks with tsc through its own tsconfig.json', async () => {
        const { id } = await create();
        const tsc = path.join(REPO_ROOT, 'node_modules/typescript/bin/tsc');
        const tsconfig = path.join(storiesRoot, id, 'tsconfig.json');
        const runTsc = async () => {
            try {
                const { stdout } = await promisify(execFile)(process.execPath, [tsc, '--noEmit', '-p', tsconfig]);
                return stdout;
            } catch (e) {
                return e instanceof Error && 'stdout' in e && typeof e.stdout === 'string' ? e.stdout : String(e);
            }
        };
        expect(await runTsc()).toBe('');
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

    it('leaves no folder and no row when the database insert fails', async () => {
        vi.spyOn(app.app.get(StoryRepository), 'insert').mockRejectedValue(new Error('database down'));
        const res = await call('POST', '/api/stories', { body: NEW_STORY });
        expect([res.status, res.body]).toEqual([500, { error: 'internal', message: 'database down' }]);
        expect(await rootEntries()).toEqual(['example']);
        expect(await app.app.get(StoryRepository).exists('my-story')).toBe(false);
    });

    it('skips an id whose folder exists without a row', async () => {
        await copyExampleStory(storiesRoot, 'my-story');
        expect((await create()).id).toBe('my-story-2');
    });
});

describe('list and info', () => {
    it('lists by name with the unlocked flag and without passwords; edits the info, versioned', async () => {
        const { id, cookie } = await create({ name: 'Alpha' });
        const listed = await call('GET', '/api/stories', { cookie });
        expect(listed.body.map((s: { id: string; unlocked: boolean }) => [s.id, s.unlocked])).toEqual([
            ['alpha', true],
            ['example', false],
        ]);
        for (const story of listed.body) expect(story).not.toHaveProperty('password');
        expect((await call('GET', '/api/stories')).body.every((s: { unlocked: boolean }) => !s.unlocked)).toBe(true);

        expect((await call('GET', `/api/stories/${id}/info`)).status).toBe(401);
        const info = await call('GET', `/api/stories/${id}/info`, { cookie });
        expect(info.status).toBe(200);
        expect(info.body).toMatchObject({ id, name: 'Alpha', mapSize: NEW_STORY.mapSize, version: '1' });
        expect(info.body.password).toBeUndefined();

        const url = `/api/stories/${id}/info`;
        const put = (body: Record<string, unknown>) => call('PUT', url, { cookie, body });
        expect((await put({ version: info.body.version, mapSize: { width: 30, height: 10 } })).status).toBe(400);
        expect((await put({ version: info.body.version, password: 'short' })).status).toBe(400);
        expect((await put({ version: info.body.version, name: '' })).status).toBe(400);
        expect((await put({ version: info.body.version, color: 'red' })).status).toBe(400);

        // the whole DTO sent back: an unchanged mapSize and id are fine
        const edited = await put({
            ...info.body,
            name: 'Alpha 2',
            public: true,
            password: 'new-password',
            hasLandingImage: true,
        });
        expect(edited.status).toBe(200);
        expect(edited.body).toMatchObject({
            id,
            name: 'Alpha 2',
            public: true,
            author: 'Tester',
            version: '2',
            hasLandingImage: false,
        });
        expect(await rootEntries()).toContain('alpha'); // the id never changes on rename

        const stale = await put({ version: info.body.version, name: 'Lost' });
        expect(stale.status).toBe(409);
        expect(stale.body).toMatchObject({ error: 'stale', current: { name: 'Alpha 2', version: '2' } });
        const staleAndInvalid = await put({ version: info.body.version, name: '' });
        expect(staleAndInvalid.status).toBe(409);

        await expect(login(base, id, { password: NEW_STORY.password })).rejects.toThrow('401');
        expect(await login(base, id, { password: 'new-password' })).toMatch(/^story_session=/);

        const kept = await put({ version: edited.body.version, password: '', description: 'Changed' });
        expect(kept.status).toBe(200);
        expect(await login(base, id, { password: 'new-password' })).toMatch(/^story_session=/);
    });
});

describe('export', () => {
    it('zips tsconfig.json, data/ and types/ only, with the download headers', async () => {
        const { id, cookie } = await create();
        const { res, bytes } = await exportZip(id, cookie);
        expect(res.headers.get('content-type')).toBe('application/zip');
        expect(res.headers.get('content-disposition')).toBe(`attachment; filename="${id}.zip"`);
        expect(res.headers.get('cache-control')).toBe('no-store');
        const names = Object.keys(unzipSync(bytes));
        expect(names).not.toContain(STORY_FILE);
        expect(names).toContain(MAP_FILE);
        expect(names.every((name) => name === 'tsconfig.json' || /^(data|types)\//.test(name))).toBe(true);
        expect((await fetch(`${base}/api/stories/${id}/export`)).status).toBe(401);
    });

    it('exports a public story without a login, and never its story.json', async () => {
        const { bytes } = await exportZip('example');
        const files = unzipSync(bytes);
        expect(Object.keys(files)).not.toContain(STORY_FILE);
        expect(Object.keys(files)).toContain('data/chapters/village/thomas.passages/intro.png');
        // the example has no map.json: the zip carries the default map the story shows
        expect(decodeMapFile(JSON.parse(new TextDecoder().decode(files[MAP_FILE])))).toMatchObject({
            width: 80,
            height: 60,
        });
    });
});

describe('import', () => {
    it('round-trips: same content and map size, metadata from the form, the importer logged in', async () => {
        const { id, cookie } = await create();
        const { bytes } = await exportZip(id, cookie);

        const imported = await importZip(bytes);
        expect(imported.status).toBe(201);
        expect(imported.body).toEqual({ id: 'copy', ...IMPORTED, password: undefined, mapSize: NEW_STORY.mapSize });
        const copyCookie = cookieOf(imported);
        expect(copyCookie).toMatch(/^story_session=/);
        expect((await call('GET', '/api/stories/copy/info', { cookie: copyCookie })).body).toMatchObject({
            name: 'Copy',
            mapSize: NEW_STORY.mapSize,
        });
        expect(Buffer.from((await exportZip('copy', copyCookie)).bytes).equals(Buffer.from(bytes))).toBe(true);
        expect(await login(base, 'copy', { password: IMPORTED.password })).toMatch(/^story_session=/);
        await expect(login(base, 'copy', { password: NEW_STORY.password })).rejects.toThrow('401');

        expect((await importZip(bytes)).body.id).toBe('copy-2');
        expect(await rootEntries()).toEqual(['copy', 'copy-2', 'example', 'my-story']);
    });

    it('round-trips the example, writing its own tsconfig.json', async () => {
        const example = (await exportZip('example')).bytes;
        const res = await importZip(example, { name: 'Example copy', public: true });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ id: 'example-copy', mapSize: { width: 80, height: 60 }, public: true });
        const copied = (await exportZip('example-copy')).bytes;
        expect(contentOf(copied)).toEqual(contentOf(example));
        const dir = path.join(storiesRoot, 'example-copy');
        expect(await readFile(path.join(dir, 'tsconfig.json'), 'utf8')).toBe(await storyTsconfig(dir));
    }, 60_000);

    it('imports a legacy zip with a story.json and ignores it', async () => {
        const { id, cookie } = await create();
        const files: Zippable = unzipSync((await exportZip(id, cookie)).bytes);
        files[STORY_FILE] = text('{ not even JSON, and certainly no password hash');
        const res = await importZip(zipSync(files));
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ id: 'copy', name: IMPORTED.name, author: IMPORTED.author });
        expect(await readdir(path.join(storiesRoot, 'copy'))).not.toContain(STORY_FILE);
    });

    it('takes the form fields as text, with the create rules', async () => {
        const { id, cookie } = await create();
        const zip = new Blob([new Uint8Array((await exportZip(id, cookie)).bytes)]);
        const form = (fields: Record<string, string>) => {
            const out = new FormData();
            for (const [key, value] of Object.entries(fields)) out.set(key, value);
            out.set('zip', zip, 'story.zip');
            return out;
        };
        const minimal = await send(form({ name: ' Minimal ', password: 'secret-1' }));
        expect(minimal.body).toMatchObject({ id: 'minimal', author: '', description: '', public: false });
        expect((await send(form({ name: 'Open', password: 'secret-1', public: 'true' }))).body.public).toBe(true);
        const invalid: Record<string, string>[] = [
            { name: '', password: 'secret-1' },
            { name: 'x', password: 'short' },
            { name: 'x' },
            { name: 'x', password: 'secret-1', public: 'yes' },
        ];
        for (const fields of invalid) {
            const res = await send(form(fields));
            expect([fields, res.status, res.body.error]).toEqual([fields, 400, 'bad_request']);
        }
        expect(await rootEntries()).toEqual(['example', 'minimal', 'my-story', 'open']);
    });

    it('refuses bad zips and leaves nothing behind', async () => {
        const { id, cookie } = await create();
        const good = (await exportZip(id, cookie)).bytes;
        const map = await readFile(path.join(storiesRoot, id, MAP_FILE));
        const ok = { [MAP_FILE]: new Uint8Array(map), 'data/index.ts': new Uint8Array([1]) };
        const zip = (files: Zippable) => zipSync(files);
        const hugeMap = await encodeMapFile(
            createDefaultMap('global', { width: STORY_LIMITS.mapSizeMax + 1, height: 1 })
        );

        const bad: [string, Uint8Array][] = [
            ['zip-slip', zip({ ...ok, '../evil.ts': text('x') })],
            ['zip-slip inside', zip({ ...ok, 'data/../../evil.ts': text('x') })],
            ['absolute', zip({ ...ok, '/etc/evil': text('x') })],
            ['backslash', zip({ ...ok, 'data\\..\\evil.ts': text('x') })],
            ['other top-level', zip({ ...ok, 'evil.txt': text('x') })],
            ['file where a folder goes', zip({ ...ok, data: text('x') })],
            ['symlink', zip({ ...ok, 'data/link.ts': [text('/etc/passwd'), { os: 3, attrs: 0o120777 << 16 }] })],
            ['no map.json', zip({ 'data/index.ts': text('x') })],
            ['map.json not JSON', zip({ ...ok, [MAP_FILE]: text('{') })],
            ['map.json invalid', zip({ ...ok, [MAP_FILE]: text('{"width": 1}') })],
            ['map too large', zip({ ...ok, [MAP_FILE]: text(hugeMap) })],
            ['not a zip', text('hello')],
            ['truncated', good.subarray(0, good.length - 30)],
        ];
        for (const [what, bytes] of bad) {
            const res = await importZip(bytes);
            expect([what, res.status, res.body.error]).toEqual([what, 400, 'bad_request']);
        }

        const noZip = new FormData();
        noZip.set('name', 'No zip');
        expect((await send(noZip)).body).toEqual({
            error: 'bad_request',
            message: 'Field "zip" must be the story zip file',
        });
        expect(await importZip(new Uint8Array(MAX_STORY_ZIP_BYTES + 1))).toMatchObject({
            status: 400,
            body: { error: 'bad_request', message: `Request body larger than ${MAX_STORY_ZIP_BYTES} bytes` },
        });
        const foreign = await send(storyImportForm(new Blob([new Uint8Array(good)]), IMPORTED), {
            origin: 'https://evil.example',
        });
        expect(foreign.status).toBe(403);

        expect(await rootEntries()).toEqual(['example', id]);
        expect((await importZip(zip(ok))).status).toBe(201);
    }, 60_000);

    it('leaves no folder and no row when the database insert fails', async () => {
        const { bytes } = await exportZip('example');
        vi.spyOn(app.app.get(StoryRepository), 'insert').mockRejectedValue(new Error('database down'));
        expect((await importZip(bytes)).status).toBe(500);
        expect(await rootEntries()).toEqual(['example']);
        expect(await app.app.get(StoryRepository).exists('copy')).toBe(false);
    });

    it('needs the example password for nothing it imported', async () => {
        const { bytes } = await exportZip('example');
        await importZip(bytes);
        await expect(login(base, 'copy', { password: EXAMPLE_PASSWORD })).rejects.toThrow('401');
    });
});
