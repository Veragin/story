import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LANDING_IMAGE_FILE, PNG_SIGNATURE } from '@story/protocol';
import { startSourceApp } from './helpers/sourceHelpers';

let t: Awaited<ReturnType<typeof startSourceApp>>;

beforeEach(async () => {
    t = await startSourceApp();
});
afterEach(async () => {
    await t.close();
});

const abs = (rel: string) => path.join(t.project.root, rel);

// the server only checks the signature
const fakePng = (tail: number) => Buffer.from([...PNG_SIGNATURE, 0, 0, 0, tail]);

const fetchFile = (url: string, headers: Record<string, string> = {}) =>
    fetch(t.base + url, { headers: { cookie: t.cookie, ...headers } });

describe('images', () => {
    it('finds a passage image next to its file and serves it with a cache-busted url', async () => {
        const res = await t.get('/api/stories/example/images/passages/village-thomas-intro');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            owner: 'passages',
            id: 'village-thomas-intro',
            file: 'data/chapters/village/thomas.passages/intro.png',
        });
        expect(res.body.version).not.toBe('');
        expect(res.body.url).toBe(
            `/api/stories/example/images/passages/village-thomas-intro/png?v=${res.body.version}`
        );

        const file = await fetchFile(res.body.url);
        expect(file.status).toBe(200);
        expect(file.headers.get('content-type')).toBe('image/png');
        const bytes = Buffer.from(await file.arrayBuffer());
        expect(bytes.equals(await readFile(abs('data/chapters/village/thomas.passages/intro.png')))).toBe(true);
        const etag = file.headers.get('etag') ?? '';
        expect(etag).not.toBe('');
        const again = await fetchFile(res.body.url, { 'if-none-match': etag });
        expect(again.status).toBe(304);
    });

    it('reports a missing image as none, and 404s an unknown owner', async () => {
        let res = await t.get('/api/stories/example/images/passages/kingdom-annie-palace');
        expect(res.body).toMatchObject({
            file: 'data/chapters/kingdom/annie.passages/palace.png',
            version: '',
            url: null,
        });
        expect((await fetchFile('/api/stories/example/images/passages/kingdom-annie-palace/png')).status).toBe(404);
        res = await t.get('/api/stories/example/images/passages/kingdom-thomas-visit');
        expect(res.body.file).toBe('data/chapters/kingdom/thomas.passages/visit.screen.png');
        expect((await t.get('/api/stories/example/images/passages/kingdom-annie-nope')).status).toBe(404);
        expect((await t.get('/api/stories/example/images/characters/nobody')).status).toBe(404);
        expect((await t.get('/api/stories/example/images/items/bow')).status).toBe(404);
    });

    it('uploads a character and an npc portrait next to their files', async () => {
        let res = await t.get('/api/stories/example/images/characters/thomas');
        expect(res.body).toMatchObject({ file: 'data/characters/thomas.png', url: null });
        res = await t.put('/api/stories/example/images/characters/thomas', {
            version: '',
            data: fakePng(1).toString('base64'),
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect((await readFile(abs('data/characters/thomas.png'))).equals(fakePng(1))).toBe(true);
        expect(res.body.url).toContain(`?v=${res.body.version}`);

        res = await t.put('/api/stories/example/images/npcs/franta', {
            version: '',
            data: fakePng(2).toString('base64'),
        });
        expect(res.status).toBe(200);
        expect(res.body.file).toBe('data/npcs/Franta.png');
        expect(existsSync(abs('data/npcs/Franta.png'))).toBe(true);
    });

    it('replaces an image only from its current version, and only with a PNG', async () => {
        const current = (await t.get('/api/stories/example/images/passages/village-thomas-intro')).body;
        let res = await t.put('/api/stories/example/images/passages/village-thomas-intro', {
            version: current.version,
            data: Buffer.from('GIF89a…').toString('base64'),
        });
        expect(res.status).toBe(400);
        res = await t.put('/api/stories/example/images/passages/village-thomas-intro', {
            version: '',
            data: fakePng(3).toString('base64'),
        });
        expect(res.status).toBe(409);
        expect(res.body.current.version).toBe(current.version);
        res = await t.put('/api/stories/example/images/passages/village-thomas-intro', {
            version: current.version,
            data: fakePng(3).toString('base64'),
        });
        expect(res.status).toBe(200);
        expect(res.body.version).not.toBe(current.version);
        expect(res.body.url).not.toBe(current.url);
    });

    it('ignores a symlinked image, as the play files do', async () => {
        await symlink(abs('data/chapters/village/thomas.passages/intro.png'), abs('data/characters/thomas.png'));
        const res = await t.get('/api/stories/example/images/characters/thomas');
        expect(res.body).toMatchObject({ file: 'data/characters/thomas.png', version: '', url: null });
        expect((await fetchFile('/api/stories/example/images/characters/thomas/png')).status).toBe(404);
    });

    it('deletes the image together with its passage', async () => {
        let res = await t.post('/api/stories/example/chapters/village/passages', {
            characterId: 'thomas',
            localId: 'pic',
            type: 'screen',
        });
        expect(res.status).toBe(201);
        res = await t.put('/api/stories/example/images/passages/village-thomas-pic', {
            version: '',
            data: fakePng(4).toString('base64'),
        });
        expect(res.status).toBe(200);
        expect(existsSync(abs('data/chapters/village/thomas.passages/pic.png'))).toBe(true);
        const passage = (await t.get('/api/stories/example/passages/village-thomas-pic')).body;
        res = await t.del('/api/stories/example/passages/village-thomas-pic', { version: passage.version });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(existsSync(abs('data/chapters/village/thomas.passages/pic.png'))).toBe(false);
    });
});

describe('the story landing image', () => {
    const LANDING = '/api/stories/example/images/story/landing';
    const landingFlags = async () => ({
        info: (await t.get('/api/stories/example/info')).body.hasLandingImage,
        manifest: (await t.get('/api/stories/example/play')).body.hasLandingImage,
    });

    it('uploads, serves and deletes it at the fixed path, flipping hasLandingImage', async () => {
        expect(await landingFlags()).toEqual({ info: false, manifest: false });
        let res = await t.get(LANDING);
        expect(res.body).toMatchObject({ owner: 'story', id: 'landing', file: LANDING_IMAGE_FILE, url: null });

        res = await t.put(LANDING, { version: '', data: fakePng(5).toString('base64') });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect((await readFile(abs(LANDING_IMAGE_FILE))).equals(fakePng(5))).toBe(true);
        expect(await landingFlags()).toEqual({ info: true, manifest: true });
        const file = await fetchFile(res.body.url);
        expect(file.status).toBe(200);
        expect(Buffer.from(await file.arrayBuffer()).equals(fakePng(5))).toBe(true);

        expect((await t.del(LANDING, { version: '' })).status).toBe(409);
        res = await t.del(LANDING, { version: res.body.version });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body).toMatchObject({ file: LANDING_IMAGE_FILE, version: '', url: null });
        expect(existsSync(abs(LANDING_IMAGE_FILE))).toBe(false);
        expect(await landingFlags()).toEqual({ info: false, manifest: false });
        expect((await fetchFile(`${LANDING}/png`)).status).toBe(404);
    });

    it('rejects another id of the story owner', async () => {
        expect((await t.get('/api/stories/example/images/story/cover')).status).toBe(404);
        const res = await t.put('/api/stories/example/images/story/cover', {
            version: '',
            data: fakePng(6).toString('base64'),
        });
        expect(res.status).toBe(404);
        expect((await t.del('/api/stories/example/images/story/cover', { version: '' })).status).toBe(404);
    });

    it('ignores a symlink, as the play manifest does', async () => {
        await mkdir(path.dirname(abs(LANDING_IMAGE_FILE)), { recursive: true });
        await symlink(abs('data/chapters/village/thomas.passages/intro.png'), abs(LANDING_IMAGE_FILE));
        expect(await landingFlags()).toEqual({ info: false, manifest: false });
        expect((await t.get(LANDING)).body.url).toBeNull();
        expect((await fetchFile(`${LANDING}/png`)).status).toBe(404);
    });

    it('neither writes nor deletes through a symlinked directory', async () => {
        const outside = await mkdtemp(path.join(tmpdir(), 'outside-assets-'));
        try {
            await writeFile(path.join(outside, 'landing.png'), fakePng(8));
            await rm(path.dirname(abs(LANDING_IMAGE_FILE)), { recursive: true, force: true });
            await symlink(outside, path.dirname(abs(LANDING_IMAGE_FILE)));
            expect((await t.del(LANDING, { version: '' })).status).toBe(403);
            expect((await t.put(LANDING, { version: '', data: fakePng(9).toString('base64') })).status).toBe(403);
            expect((await readFile(path.join(outside, 'landing.png'))).equals(fakePng(8))).toBe(true);
        } finally {
            await rm(outside, { recursive: true, force: true });
        }
    });
});

describe('deleteImage', () => {
    it('deletes a portrait only from its current version', async () => {
        const up = await t.put('/api/stories/example/images/characters/thomas', {
            version: '',
            data: fakePng(7).toString('base64'),
        });
        expect((await t.del('/api/stories/example/images/characters/thomas', { version: 'nope' })).status).toBe(409);
        const res = await t.del('/api/stories/example/images/characters/thomas', { version: up.body.version });
        expect(res.status).toBe(200);
        expect(res.body.url).toBeNull();
        expect(existsSync(abs('data/characters/thomas.png'))).toBe(false);
    });
});

describe('image descriptions', () => {
    it('reads and writes `image` of characters and npcs as an optional string', async () => {
        let npc = (await t.get('/api/stories/example/entities/npcs/franta')).body;
        expect(npc.image).toBeUndefined();
        let res = await t.put('/api/stories/example/entities/npcs/franta', {
            version: npc.version,
            image: 'An old man with a cane',
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        npc = (await t.get('/api/stories/example/entities/npcs/franta')).body;
        expect(npc.image).toBe('An old man with a cane');
        expect(await readFile(abs('data/npcs/Franta.ts'), 'utf8')).toContain(
            "description: 'Franta is a very old',\n    image: 'An old man with a cane',"
        );

        const thomas = (await t.get('/api/stories/example/entities/characters/thomas')).body;
        res = await t.put('/api/stories/example/entities/characters/thomas', {
            version: thomas.version,
            image: 'A young hunter',
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.image).toBe('A young hunter');
    });
});
