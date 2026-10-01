import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { changedFiles, snapshot, startSourceApp } from './sourceHelpers';

let t: Awaited<ReturnType<typeof startSourceApp>>;

beforeEach(async () => {
    t = await startSourceApp();
});
afterEach(async () => {
    await t.close();
});

const S = '/api/stories/example/source';
const CHAPTER = 'data/chapters/village/village.chapter.ts';
const PASSAGE = 'data/chapters/village/thomas.passages/intro.ts';
const read = (rel: string) => readFile(path.join(t.project.root, rel), 'utf8');

describe('source editor', () => {
    it('reads the whole file of a chapter and of a passage', async () => {
        const chapter = await t.get(`${S}/chapter/village`);
        expect(chapter.status).toBe(200);
        expect(chapter.body).toMatchObject({ file: CHAPTER, text: await read(CHAPTER) });
        expect(chapter.body.version).toMatch(/^[0-9a-f]{16}$/);

        const passage = await t.get(`${S}/passage/village-thomas-intro`);
        expect(passage.body).toMatchObject({ file: PASSAGE, text: await read(PASSAGE) });
        const dto = await t.get('/api/stories/example/passages/village-thomas-intro');
        expect(passage.body.version).toBe(dto.body.version);
    });

    it('saves formatted text with one event, and answers 409 stale on an old version', async () => {
        const before = await t.get(`${S}/chapter/village`);
        const text = before.body.text.replace("title: 'Village Chapter'", 'title:   "Hamlet Chapter"');
        t.events.length = 0;
        const saved = await t.put(`${S}/chapter/village`, { version: before.body.version, text });
        expect(saved.status).toBe(200);
        // prettier ran
        expect(saved.body.text).toContain("title: 'Hamlet Chapter',");
        expect(await read(CHAPTER)).toBe(saved.body.text);
        expect(saved.body.version).not.toBe(before.body.version);
        expect(t.events).toEqual([expect.objectContaining({ kind: 'chapter', id: 'village', op: 'updated' })]);
        const chapter = await t.get('/api/stories/example/chapters/village');
        expect(chapter.body.title).toBe('Hamlet Chapter');
        expect(t.events[0].version).toBe(chapter.body.version);

        const stale = await t.put(`${S}/chapter/village`, { version: before.body.version, text });
        expect(stale.status).toBe(409);
        expect(stale.body.error).toBe('stale');
        expect(stale.body.current).toEqual(saved.body);
    });

    it('sees a hand edit and then refuses the old version', async () => {
        const before = await t.get(`${S}/passage/village-thomas-intro`);
        await writeFile(path.join(t.project.root, PASSAGE), before.body.text + '\n// by hand\n');
        const res = await t.put(`${S}/passage/village-thomas-intro`, {
            version: before.body.version,
            text: before.body.text,
        });
        expect(res.status).toBe(409);
        expect(res.body.current.text).toContain('// by hand');
    });

    it('refuses a type error or a syntax error with line-based diagnostics and writes nothing', async () => {
        const before = await t.get(`${S}/chapter/village`);
        const files = await snapshot(t.project.root);
        t.events.length = 0;

        const lines = before.body.text.split('\n');
        const at = lines.findIndex((l: string) => l.includes("location: 'village'"));
        lines[at] = "    location: 'atlantis',";
        const typeError = await t.put(`${S}/chapter/village`, { version: before.body.version, text: lines.join('\n') });
        expect(typeError.status).toBe(422);
        expect(typeError.body.error).toBe('invalid');
        expect(typeError.body.diagnostics).toEqual([
            expect.objectContaining({ file: CHAPTER, line: at + 1, message: expect.stringContaining('atlantis') }),
        ]);

        const syntax = await t.put(`${S}/chapter/village`, {
            version: before.body.version,
            text: 'export const x = {\n    a: 1,\n    b: \n};\n',
        });
        expect(syntax.status).toBe(422);
        expect(syntax.body.diagnostics[0]).toMatchObject({ file: CHAPTER, line: 4 });

        expect(changedFiles(files, await snapshot(t.project.root))).toEqual([]);
        expect(t.events).toEqual([]);
        expect((await t.get(`${S}/chapter/village`)).body).toEqual(before.body);
    });

    it('only reaches chapter and passage files under data/', async () => {
        for (const url of [
            `${S}/chapter/nope`,
            `${S}/passage/village-thomas-nope`,
            `${S}/chapter/..%2F..%2Fstory.json`,
            `${S}/chapter/..%2F..%2F..%2Ftypes%2Findex`,
            `${S}/passage/..%2F..-x-y`,
            `${S}/register/x`,
            `${S}/passages/village-thomas-intro`,
        ]) {
            const res = await t.get(url);
            expect([url, res.status]).toEqual([url, 404]);
        }
        const res = await t.put(`${S}/types/index`, { version: '', text: 'export {};' });
        expect(res.status).toBe(404);
        const bad = await t.put(`${S}/chapter/village`, { version: 'x' });
        expect(bad.status).toBe(400);
    });
});
