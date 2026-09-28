import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PNG_SIGNATURE } from '@story/visualizer-protocol';
import { startSourceApp } from './sourceHelpers';

/**
 * Story art (`project/images.ts`): the image of a passage / character / npc is the `.png` next to
 * its `.ts` file. Every scenario runs on its own temp copy.
 */
let t: Awaited<ReturnType<typeof startSourceApp>>;

beforeEach(async () => {
    t = await startSourceApp();
});
afterEach(async () => {
    await t.close();
});

const abs = (rel: string) => path.join(t.project.root, rel);

/** A PNG signature plus a few bytes — enough for the server, which only checks the signature. */
const fakePng = (tail: number) => Buffer.from([...PNG_SIGNATURE, 0, 0, 0, tail]);

/** A raw GET (the `/png` route answers bytes, not JSON). */
const fetchFile = (url: string, headers: Record<string, string> = {}) => {
    const { port } = t.app.server.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${port}${url}`, { headers });
};

describe('images', () => {
    it('finds a passage image next to its file and serves it with a cache-busted url', async () => {
        const res = await t.get('/api/images/passages/village-thomas-intro');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            owner: 'passages',
            id: 'village-thomas-intro',
            file: 'data/chapters/village/thomas.passages/intro.png',
        });
        expect(res.body.version).not.toBe('');
        expect(res.body.url).toBe(`/api/images/passages/village-thomas-intro/png?v=${res.body.version}`);

        const file = await fetchFile(res.body.url);
        expect(file.status).toBe(200);
        expect(file.headers.get('content-type')).toBe('image/png');
        const bytes = Buffer.from(await file.arrayBuffer());
        expect(bytes.equals(await readFile(abs('data/chapters/village/thomas.passages/intro.png')))).toBe(true);
        const again = await fetchFile(res.body.url, { 'if-none-match': file.headers.get('etag')! });
        expect(again.status).toBe(304);
    });

    it('reports a missing image as none, and 404s an unknown owner', async () => {
        let res = await t.get('/api/images/passages/kingdom-annie-palace');
        expect(res.body).toMatchObject({
            file: 'data/chapters/kingdom/annie.passages/palace.png',
            version: '',
            url: null,
        });
        expect((await fetchFile('/api/images/passages/kingdom-annie-palace/png')).status).toBe(404);
        // suffixed passage files keep their whole basename
        res = await t.get('/api/images/passages/kingdom-thomas-visit');
        expect(res.body.file).toBe('data/chapters/kingdom/thomas.passages/visit.screen.png');
        expect((await t.get('/api/images/passages/kingdom-annie-nope')).status).toBe(404);
        expect((await t.get('/api/images/characters/nobody')).status).toBe(404);
        expect((await t.get('/api/images/items/bow')).status).toBe(404);
    });

    it('uploads a character and an npc portrait next to their files', async () => {
        let res = await t.get('/api/images/characters/thomas');
        expect(res.body).toMatchObject({ file: 'data/characters/thomas.png', url: null });
        res = await t.put('/api/images/characters/thomas', { version: '', data: fakePng(1).toString('base64') });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect((await readFile(abs('data/characters/thomas.png'))).equals(fakePng(1))).toBe(true);
        expect(res.body.url).toContain(`?v=${res.body.version}`);

        // npc files are named after the export
        res = await t.put('/api/images/npcs/franta', { version: '', data: fakePng(2).toString('base64') });
        expect(res.status).toBe(200);
        expect(res.body.file).toBe('data/npcs/Franta.png');
        expect(existsSync(abs('data/npcs/Franta.png'))).toBe(true);
    });

    it('replaces an image only from its current version, and only with a PNG', async () => {
        const current = (await t.get('/api/images/passages/village-thomas-intro')).body;
        let res = await t.put('/api/images/passages/village-thomas-intro', {
            version: current.version,
            data: Buffer.from('GIF89a…').toString('base64'),
        });
        expect(res.status).toBe(400);
        res = await t.put('/api/images/passages/village-thomas-intro', {
            version: '',
            data: fakePng(3).toString('base64'),
        });
        expect(res.status).toBe(409);
        expect(res.body.current.version).toBe(current.version);
        res = await t.put('/api/images/passages/village-thomas-intro', {
            version: current.version,
            data: fakePng(3).toString('base64'),
        });
        expect(res.status).toBe(200);
        expect(res.body.version).not.toBe(current.version);
        expect(res.body.url).not.toBe(current.url);
    });

    it('deletes the image together with its passage', async () => {
        let res = await t.post('/api/chapters/village/passages', {
            characterId: 'thomas',
            localId: 'pic',
            type: 'screen',
        });
        expect(res.status).toBe(201);
        res = await t.put('/api/images/passages/village-thomas-pic', {
            version: '',
            data: fakePng(4).toString('base64'),
        });
        expect(res.status).toBe(200);
        expect(existsSync(abs('data/chapters/village/thomas.passages/pic.png'))).toBe(true);
        const passage = (await t.get('/api/passages/village-thomas-pic')).body;
        res = await t.del('/api/passages/village-thomas-pic', { version: passage.version });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(existsSync(abs('data/chapters/village/thomas.passages/pic.png'))).toBe(false);
    });
});

describe('image descriptions', () => {
    it('reads and writes `image` of characters and npcs as an optional string', async () => {
        let npc = (await t.get('/api/entities/npcs/franta')).body;
        expect(npc.image).toBeUndefined();
        let res = await t.put('/api/entities/npcs/franta', { version: npc.version, image: 'An old man with a cane' });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        npc = (await t.get('/api/entities/npcs/franta')).body;
        expect(npc.image).toBe('An old man with a cane');
        // added next to the description, not after `init`
        expect(await readFile(abs('data/npcs/Franta.ts'), 'utf8')).toContain(
            "description: 'Franta is a very old',\n    image: 'An old man with a cane',"
        );

        const thomas = (await t.get('/api/entities/characters/thomas')).body;
        res = await t.put('/api/entities/characters/thomas', { version: thomas.version, image: 'A young hunter' });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.image).toBe('A young hunter');
    });
});
