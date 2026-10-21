import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildPath, LANDING_IMAGE_FILE, PLAY_MANIFEST_FILE, PNG_SIGNATURE } from '@story/protocol';
import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TMP_SUFFIX } from '../src/json/atomicWrite';
import { login, requestJson } from './helpers/http';
import { createTestApp, readExampleStoryFile, type TTestApp } from './helpers/testApp';

let app: TTestApp;
let playerDir: string;

const playerHtml = () => path.join(playerDir, 'index.html');

beforeEach(async () => {
    playerDir = await mkdtemp(path.join(tmpdir(), 'standalone-player-'));
    app = await createTestApp({
        stories: [
            { id: 'open', public: true },
            { id: 'closed', public: false },
        ],
        standalonePlayerHtml: playerHtml(),
    });
});

afterEach(async () => {
    await app.close();
    await rm(playerDir, { recursive: true, force: true });
});

const abs = (storyId: string, rel: string) => path.join(app.project(storyId).root, rel);

const manifest = (storyId: string, cookie?: string) =>
    requestJson(app.base + buildPath(storyId, 'getPlayManifest', {}), 'GET', {
        headers: cookie ? { cookie } : {},
    });

const playFile = (storyId: string, file: string, headers: Record<string, string> = {}) =>
    fetch(app.base + buildPath(storyId, 'getPlayFile', { file }), { headers });

describe('play access', () => {
    it('serves a public story without a login', async () => {
        expect((await manifest('open')).status).toBe(200);
        expect((await playFile('open', 'data/register.ts')).status).toBe(200);
    });

    it('serves a private story only to a session with its grant', async () => {
        expect((await manifest('closed')).status).toBe(401);
        expect((await playFile('closed', 'data/register.ts')).status).toBe(401);
        const cookie = await login(app.base, 'closed');
        expect((await manifest('closed', cookie)).status).toBe(200);
        expect((await playFile('closed', 'data/register.ts', { cookie })).status).toBe(200);
    });

    it('404s an unknown story', async () => {
        expect((await manifest('nope')).status).toBe(404);
    });
});

describe('getPlayManifest', () => {
    it('carries the metadata without the password, and the playable files only', async () => {
        const res = await manifest('open');
        const { name, author, description } = await readExampleStoryFile();
        expect(res.body).toMatchObject({ id: 'open', name, author, description, hasLandingImage: false });
        expect(res.body.version).not.toBe('');
        expect(res.body).not.toHaveProperty('password');
        const files: string[] = res.body.files;
        expect(files).toContain('data/register.ts');
        expect(files).toContain('types/index.ts');
        expect(files).toContain('data/chapters/village/thomas.passages/intro.png');
        expect(files).toEqual([...files].sort());
        expect(files.every((f) => /^(data|types)\/.+\.(ts|png)$/.test(f))).toBe(true);
        expect(files.some((f) => f.includes('__tests__') || f.includes('node_modules'))).toBe(false);
    });

    it('skips temp files, node_modules and symlinks', async () => {
        await mkdir(abs('open', 'data/node_modules/pkg'), { recursive: true });
        await writeFile(abs('open', 'data/node_modules/pkg/index.ts'), 'export {};');
        await writeFile(abs('open', `data/.half.ts.abc${TMP_SUFFIX}`), 'export {};');
        await symlink(abs('open', 'data/register.ts'), abs('open', 'data/link.ts'));
        const files: string[] = (await manifest('open')).body.files;
        expect(files.filter((f) => /node_modules|half|link/.test(f))).toEqual([]);
    });

    it('reports the landing image', async () => {
        await mkdir(path.dirname(abs('open', LANDING_IMAGE_FILE)), { recursive: true });
        await writeFile(abs('open', LANDING_IMAGE_FILE), Buffer.from([...PNG_SIGNATURE, 0]));
        const res = await manifest('open');
        expect(res.body.hasLandingImage).toBe(true);
        expect(res.body.files).toContain(LANDING_IMAGE_FILE);
    });
});

describe('getPlayFile', () => {
    it('serves a source file with its content type, a versioned ETag and no-cache', async () => {
        const res = await playFile('open', 'data/register.ts');
        expect(res.headers.get('content-type')).toMatch(/^text\/typescript/);
        expect(res.headers.get('cache-control')).toBe('no-cache');
        expect(await res.text()).toBe(await readFile(abs('open', 'data/register.ts'), 'utf8'));
        const etag = res.headers.get('etag') ?? '';
        expect(etag).not.toBe('');
        expect((await playFile('open', 'data/register.ts', { 'if-none-match': etag })).status).toBe(304);

        await writeFile(abs('open', 'data/register.ts'), '// changed\n');
        const changed = await playFile('open', 'data/register.ts', { 'if-none-match': etag });
        expect(changed.status).toBe(200);
        expect(changed.headers.get('etag')).not.toBe(etag);
    });

    it('serves an image as PNG', async () => {
        const res = await playFile('open', 'data/chapters/village/thomas.passages/intro.png');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/png');
        const bytes = Buffer.from(await res.arrayBuffer());
        expect(bytes.equals(await readFile(abs('open', 'data/chapters/village/thomas.passages/intro.png')))).toBe(true);
    });

    it('rejects paths outside data/ and types/, traversal and other file types', async () => {
        const rejected = [
            '../closed/data/register.ts',
            'data/../../closed/data/register.ts',
            'data/./register.ts',
            '/etc/passwd.ts',
            'data//register.ts',
            'data\\register.ts',
            'tsconfig.json',
            'story.json',
            'data/package.json',
            'data/tsconfig.json',
            'data/register.js',
            'data/__tests__/story.test.ts',
            'data/node_modules/pkg/index.ts',
            `data/.half.ts.abc${TMP_SUFFIX}`,
            'other/file.ts',
        ];
        for (const file of rejected) expect((await playFile('open', file)).status, file).toBe(400);
    });

    it('does not follow symlinks', async () => {
        await symlink(abs('closed', 'data/register.ts'), abs('open', 'data/link.ts'));
        await symlink(abs('closed', 'data'), abs('open', 'data/linked'));
        expect((await playFile('open', 'data/link.ts')).status).toBe(404);
        expect((await playFile('open', 'data/linked/register.ts')).status).toBe(404);
    });

    it('404s a missing file', async () => {
        expect((await playFile('open', 'data/missing.ts')).status).toBe(404);
        expect((await playFile('open', 'data/missing/deeper.png')).status).toBe(404);
    });
});

const exportPlayable = (storyId: string, cookie?: string) =>
    fetch(app.base + buildPath(storyId, 'exportPlayable', {}), { headers: cookie ? { cookie } : {} });

describe('exportPlayable', () => {
    const PLAYER_HTML = '<!doctype html><title>player</title>';

    it('zips the standalone player, the manifest and the story files', async () => {
        await writeFile(playerHtml(), PLAYER_HTML);
        const res = await exportPlayable('open');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/zip');
        expect(res.headers.get('content-disposition')).toBe('attachment; filename="open-web.zip"');

        const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
        const text = (name: string) => new TextDecoder().decode(zip[name]);
        expect(text('index.html')).toBe(PLAYER_HTML);
        expect(JSON.parse(text(PLAY_MANIFEST_FILE))).toEqual((await manifest('open')).body);
        const { files }: { files: string[] } = JSON.parse(text(PLAY_MANIFEST_FILE));
        for (const file of files) {
            expect(Buffer.from(zip[file]).equals(await readFile(abs('open', file))), file).toBe(true);
        }
        expect(
            Object.keys(zip).every((name) => /^(index\.html|play\.json|tsconfig\.json|(data|types)\/.+)$/.test(name))
        ).toBe(true);
    });

    it('never carries the password', async () => {
        await writeFile(playerHtml(), PLAYER_HTML);
        const stored = await app.stories.read('open');
        const zip = unzipSync(new Uint8Array(await (await exportPlayable('open')).arrayBuffer()));
        const manifestText = new TextDecoder().decode(zip[PLAY_MANIFEST_FILE]);
        expect(manifestText).not.toContain('password');
        expect(manifestText).not.toContain(stored?.password ?? '?');
        expect(Object.keys(zip)).not.toContain('story.json');
    });

    it('needs the story`s grant like the story export', async () => {
        await writeFile(playerHtml(), PLAYER_HTML);
        expect((await exportPlayable('closed')).status).toBe(401);
        const cookie = await login(app.base, 'closed');
        expect((await exportPlayable('closed', cookie)).status).toBe(200);
        expect((await exportPlayable('nope')).status).toBe(404);
    });

    it('answers 503 while the standalone player is not built', async () => {
        const res = await exportPlayable('open');
        expect(res.status).toBe(503);
        const body: { error: string; message: string } = await res.json();
        expect(body.error).toBe('unavailable');
        expect(body.message).toMatch(/standalone player is not built/);
    });
});
