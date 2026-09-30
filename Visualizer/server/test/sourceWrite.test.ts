import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { changedFiles, snapshot, startSourceApp, storyProblems, tscTemp } from './sourceHelpers';

/**
 * Writers and the registry (plan WP2 "Tests"). Every scenario runs on its own temp copy; after
 * each step the static story checks run, and each scenario ends with a real `tsc --noEmit`.
 */
let t: Awaited<ReturnType<typeof startSourceApp>>;

beforeEach(async () => {
    t = await startSourceApp();
});
afterEach(async () => {
    await t.close();
});

const read = (rel: string) => readFile(path.join(t.project.root, rel), 'utf8');
const exists = (rel: string) => existsSync(path.join(t.project.root, rel));

const expectHealthy = async () => {
    expect(await storyProblems(t.project.root)).toEqual([]);
};

const expectTsc = async () => {
    const tsc = await tscTemp(t.project.root);
    expect(tsc.output).toBe('');
    expect(tsc.ok).toBe(true);
};

describe('passages', () => {
    it('keeps a closure in a code field when a sibling literal changes', async () => {
        const forest = (await t.get('/api/stories/example/passages/village-thomas-forest')).body;
        const link = forest.body[0].links[0];
        // 1. give the link a closure (a code field) …
        const closure = "() => {\n    // keep me\n    console.log('hunted');\n}";
        let res = await t.put('/api/stories/example/passages/village-thomas-forest', {
            version: forest.version,
            body: [{ ...forest.body[0], links: [{ ...link, onFinish: { code: closure } }] }],
        });
        expect(res.status).toBe(200);
        let text = await read('data/chapters/village/thomas.passages/forest.ts');
        expect(text).toContain('// keep me');
        expect(text).toContain("console.log('hunted');");

        // 2. … then edit only the sibling `text` literal, sending back what we read
        const after = res.body;
        const nextLink = { ...after.body[0].links[0], text: 'Lets hunt deer' };
        res = await t.put('/api/stories/example/passages/village-thomas-forest', {
            version: after.version,
            body: [{ ...after.body[0], links: [nextLink] }],
        });
        expect(res.status).toBe(200);
        text = await read('data/chapters/village/thomas.passages/forest.ts');
        expect(text).toContain("text: 'Lets hunt deer'");
        expect(text).toContain('// keep me');
        expect(text).toContain("console.log('hunted');");
        // the other code field (the conditional cost) is untouched too
        expect(text).toContain('cost: s.time.s < 10 ? DeltaTime.fromMin(1) : DeltaTime.fromMin(2),');
        expect(res.body.body[0].links[0].onFinish.code).toContain("console.log('hunted');");
        await expectHealthy();
        await expectTsc();
    }, 60_000);

    it('edits the description of execute (a JSDoc) without touching its code, and removes execute', async () => {
        const file = 'data/chapters/village/thomas.passages/forest.ts';
        const url = '/api/stories/example/passages/village-thomas-forest';
        const original = await read(file);
        const forest = (await t.get(url)).body;
        const code = forest.execute.code;
        const put = async (patch: Record<string, unknown>) => {
            const current = (await t.get(url)).body;
            const res = await t.put(url, { version: current.version, ...patch });
            expect(res.status, JSON.stringify(res.body)).toBe(200);
            return res.body;
        };

        // change the description: only the comment changes
        let dto = await put({ execute: { code, description: 'Heals Annie.' } });
        expect(dto.execute).toEqual({ code, description: 'Heals Annie.' });
        expect(await read(file)).toBe(
            original.replace('/** Annie gets healed when she is weak. */', '/** Heals Annie. */')
        );

        // a `*/` in the text is escaped, and reads back as written
        dto = await put({ execute: { code, description: 'Heals */ Annie.' } });
        expect(dto.execute.description).toBe('Heals */ Annie.');
        expect(await read(file)).toContain('/** Heals *\\/ Annie. */');

        // several lines become ` * ` lines
        dto = await put({ execute: { code, description: 'Heals Annie\nwhen she is weak.' } });
        expect(dto.execute).toEqual({ code, description: 'Heals Annie\nwhen she is weak.' });
        expect(await read(file)).toContain(
            '    /**\n     * Heals Annie\n     * when she is weak.\n     */\n    execute: () => {'
        );

        // no description: the comment goes, the code stays
        dto = await put({ execute: { code } });
        expect(dto.execute).toEqual({ code });
        expect(await read(file)).toBe(original.replace('    /** Annie gets healed when she is weak. */\n', ''));

        // set it again
        dto = await put({ execute: { code, description: 'Annie gets healed when she is weak.' } });
        expect(await read(file)).toBe(original);

        // `null` removes execute together with its comment
        dto = await put({ execute: null });
        expect(dto.execute).toBeUndefined();
        let text = await read(file);
        expect(text).not.toContain('execute');
        expect(text).not.toContain('Annie gets healed');
        expect(text).toContain("    id: 'forest',\n\n    type: 'screen',");

        // a description-only stub gets `() => {}` (D8), added after `id`
        dto = await put({ execute: { code: '', description: 'Something happens.' } });
        expect(dto.execute).toEqual({ code: '() => {}', description: 'Something happens.' });
        text = await read(file);
        expect(text).toMatch(/ {4}id: 'forest',\n\s*\/\*\* Something happens\. \*\/\n {4}execute: \(\) => \{\},\n/);
        await expectHealthy();
        await expectTsc();
    }, 60_000);

    it('reads and writes descriptions of link onFinish and body conditions', async () => {
        const file = 'data/chapters/village/thomas.passages/forest.ts';
        const url = '/api/stories/example/passages/village-thomas-forest';
        const forest = (await t.get(url)).body;
        expect(forest.body[0].condition).toEqual({ code: 'true' });
        const item = forest.body[0];
        const link = item.links[0];
        let res = await t.put(url, {
            version: forest.version,
            body: [
                {
                    ...item,
                    condition: { code: 's.time.s >= 0', description: 'Always, really.' },
                    links: [{ ...link, onFinish: { code: '', description: 'Nothing yet.' } }],
                },
                // a new item: generated as a whole, with the comment on its own line
                { condition: { code: '', description: 'A stub condition.' }, text: 'More' },
            ],
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.body[0].condition).toEqual({ code: 's.time.s >= 0', description: 'Always, really.' });
        expect(res.body.body[0].links[0].onFinish).toEqual({ code: '() => {}', description: 'Nothing yet.' });
        expect(res.body.body[1].condition).toEqual({ code: 'true', description: 'A stub condition.' });
        let text = await read(file);
        expect(text).toContain('/** Always, really. */\n            condition: s.time.s >= 0,');
        expect(text).toContain('/** Nothing yet. */\n                    onFinish: () => {},');
        expect(text).toContain('/** A stub condition. */\n            condition: true,');

        // removing the fields removes their comments
        res = await t.put(url, { version: res.body.version, body: [{ text: item.text, links: [link] }] });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        text = await read(file);
        expect(text).not.toContain('Always, really.');
        expect(text).not.toContain('Nothing yet.');
        expect(text).not.toContain('onFinish');
        expect(text).not.toContain('condition:');
        await expectHealthy();
        await expectTsc();
    }, 60_000);

    it('keeps a trigger closure when a sibling literal changes', async () => {
        const trigger = (await t.get('/api/stories/example/triggers/nobleHouseRobbery')).body;
        const before = await read('data/chapters/village/triggers.ts');
        const res = await t.put('/api/stories/example/triggers/nobleHouseRobbery', {
            version: trigger.version,
            description: 'Robbery!',
        });
        expect(res.status).toBe(200);
        const text = await read('data/chapters/village/triggers.ts');
        expect(text).toBe(before.replace("description: 'Noble house robbery'", "description: 'Robbery!'"));
    });

    it('answers 422 for invalid code and leaves the file unchanged', async () => {
        const before = await snapshot(t.project.root);
        const forest = (await t.get('/api/stories/example/passages/village-thomas-forest')).body;
        // does not parse
        let res = await t.put('/api/stories/example/passages/village-thomas-forest', {
            version: forest.version,
            title: { code: '1 +' },
        });
        expect(res.status).toBe(422);
        expect(res.body.error).toBe('invalid');
        expect(res.body.diagnostics[0].field).toBe('title');
        // smuggles a sibling property in
        res = await t.put('/api/stories/example/passages/village-thomas-forest', {
            version: forest.version,
            title: { code: "'a', image: 'b'" },
        });
        expect(res.status).toBe(422);
        // parses, but does not type-check (`title: string`)
        res = await t.put('/api/stories/example/passages/village-thomas-forest', {
            version: forest.version,
            title: { code: '42' },
        });
        expect(res.status).toBe(422);
        expect(res.body.diagnostics[0]).toMatchObject({
            file: 'data/chapters/village/thomas.passages/forest.ts',
            code: 2322,
        });
        expect(res.body.diagnostics[0].line).toBeGreaterThan(1);
        // a link to a passage that does not exist is a type error too (the id union)
        const link = forest.body[0].links[0];
        res = await t.put('/api/stories/example/passages/village-thomas-forest', {
            version: forest.version,
            body: [{ ...forest.body[0], links: [{ ...link, passageId: 'village-thomas-nowhere' }] }],
        });
        expect(res.status).toBe(422);
        expect(changedFiles(before, await snapshot(t.project.root))).toEqual([]);
        // and the in-memory project was rolled back: a valid edit still works
        res = await t.put('/api/stories/example/passages/village-thomas-forest', {
            version: forest.version,
            title: 'Deep forest',
        });
        expect(res.status).toBe(200);
        expect(changedFiles(before, await snapshot(t.project.root))).toEqual([
            'data/chapters/village/thomas.passages/forest.ts',
        ]);
    });

    it('checks versions: stale → 409 and nothing changes, current → new version', async () => {
        const intro = (await t.get('/api/stories/example/passages/village-thomas-intro')).body;
        const before = await snapshot(t.project.root);
        let res = await t.put('/api/stories/example/passages/village-thomas-intro', {
            version: 'deadbeefdeadbeef',
            title: 'X',
        });
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('stale');
        expect(res.body.current.version).toBe(intro.version);
        res = await t.del('/api/stories/example/passages/village-thomas-intro', { version: 'deadbeefdeadbeef' });
        expect(res.status).toBe(409);
        expect(changedFiles(before, await snapshot(t.project.root))).toEqual([]);

        res = await t.put('/api/stories/example/passages/village-thomas-intro', {
            version: intro.version,
            title: 'The start',
        });
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('The start');
        expect(res.body.version).not.toBe(intro.version);
        expect((await t.get('/api/stories/example/passages/village-thomas-intro')).body.version).toBe(res.body.version);
        // the old version is stale now
        res = await t.put('/api/stories/example/passages/village-thomas-intro', {
            version: intro.version,
            title: 'Again',
        });
        expect(res.status).toBe(409);
        // a hand edit makes the version stale as well
        const file = path.join(t.project.root, 'data/chapters/village/thomas.passages/intro.ts');
        const current = (await t.get('/api/stories/example/passages/village-thomas-intro')).body;
        await writeFile(file, (await readFile(file, 'utf8')).replace(/image: '[^']*'/, "image: 'story'"));
        res = await t.put('/api/stories/example/passages/village-thomas-intro', {
            version: current.version,
            title: 'Again',
        });
        expect(res.status).toBe(409);
        expect(res.body.current.image).toBe('story');
    });

    it('creates, updates and deletes screen, linear and transition passages', async () => {
        for (const type of ['screen', 'linear', 'transition'] as const) {
            const localId = `new${type}`;
            const id = `village-thomas-${localId}`;
            let res = await t.post('/api/stories/example/chapters/village/passages', {
                characterId: 'thomas',
                localId,
                type,
            });
            expect(res.status, JSON.stringify(res.body)).toBe(201);
            expect(res.body).toMatchObject({ passageId: id, type, exportName: `${localId}Passage` });
            expect(exists(`data/chapters/village/thomas.passages/${localId}.ts`)).toBe(true);
            expect(await read('data/chapters/village/village.passages.ts')).toContain(`'${id}': ${localId}Passage`);
            await expectHealthy();

            const patch =
                type === 'screen'
                    ? {
                          title: 'A new screen',
                          image: 'A hunter at the edge of the forest',
                          body: [
                              {
                                  condition: { code: 's.time.s > 0' },
                                  text: 'Hello',
                                  links: [{ text: 'Back', passageId: 'village-thomas-intro', cost: { seconds: 120 } }],
                              },
                          ],
                      }
                    : type === 'linear'
                      ? { description: 'Walking', nextPassageId: 'village-thomas-intro' }
                      : { nextPassageId: 'kingdom-thomas-visit' };
            res = await t.put(`/api/stories/example/passages/${id}`, { version: res.body.version, ...patch });
            if (type === 'screen') {
                // `s` is not a parameter of the generated passage: a type error, nothing written
                expect(res.status).toBe(422);
                res = await t.get(`/api/stories/example/passages/${id}`);
                res = await t.put(`/api/stories/example/passages/${id}`, {
                    version: res.body.version,
                    ...patch,
                    body: [{ ...patch.body![0], condition: { code: 'true' } }],
                });
            }
            expect(res.status, JSON.stringify(res.body)).toBe(200);
            expect(res.body).toMatchObject(
                type === 'screen' ? { ...patch, body: [{ ...patch.body![0], condition: { code: 'true' } }] } : patch
            );
            await expectHealthy();

            const listed = (await t.get('/api/stories/example/chapters/village/passages')).body;
            expect(listed.edges).toContainEqual(
                expect.objectContaining({
                    from: id,
                    to: type === 'transition' ? 'kingdom-thomas-visit' : 'village-thomas-intro',
                    resolved: true,
                })
            );

            res = await t.del(`/api/stories/example/passages/${id}`, { version: res.body.version });
            expect(res.status).toBe(200);
            expect(exists(`data/chapters/village/thomas.passages/${localId}.ts`)).toBe(false);
            expect(await read('data/chapters/village/village.passages.ts')).not.toContain(id);
            await expectHealthy();
        }
        await expectTsc();
    }, 60_000);

    it('refuses bad ids, duplicates, unknown characters and referenced deletes', async () => {
        expect(
            (
                await t.post('/api/stories/example/chapters/village/passages', {
                    characterId: 'thomas',
                    localId: 'a-b',
                    type: 'screen',
                })
            ).status
        ).toBe(400);
        expect(
            (
                await t.post('/api/stories/example/chapters/village/passages', {
                    characterId: 'thomas',
                    localId: 'intro',
                    type: 'screen',
                })
            ).status
        ).toBe(409);
        expect(
            (
                await t.post('/api/stories/example/chapters/village/passages', {
                    characterId: 'annie',
                    localId: 'x',
                    type: 'screen',
                })
            ).status
        ).toBe(400);
        expect(
            (
                await t.post('/api/stories/example/chapters/village/passages', {
                    characterId: 'thomas',
                    localId: 'x',
                    type: 'nope',
                })
            ).status
        ).toBe(400);
        const forest = (await t.get('/api/stories/example/passages/village-thomas-forest')).body;
        const res = await t.del('/api/stories/example/passages/village-thomas-forest', { version: forest.version });
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('referenced');
        expect(res.body.references).toEqual([
            expect.objectContaining({
                file: 'data/chapters/village/thomas.passages/intro.ts',
                passageId: 'village-thomas-intro',
                text: "passageId: 'village-thomas-forest',",
            }),
        ]);
    });
});

describe('chapters', () => {
    it('creates, edits, fills and deletes a chapter; one event per operation', async () => {
        t.events.length = 0;
        let res = await t.post('/api/stories/example/chapters', {
            chapterId: 'harbor',
            title: 'Harbor',
            location: 'village',
            timeRange: { start: '6.1. 8:00', end: '7.1. 8:00' },
        });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        expect(t.events).toEqual([expect.objectContaining({ kind: 'chapter', id: 'harbor', op: 'created' })]);
        expect(t.events[0].version).toBe(res.body.version);
        expect(await read('data/register.ts')).toContain("harbor: () => import('./chapters/harbor/harbor.passages')");
        expect(await read('data/TWorldState.ts')).toContain(
            "harbor: { ref: TChapter<'harbor'> } & THarborChapterData;"
        );
        expect((await t.get('/api/stories/example/project')).body.chapters.map((c: { id: string }) => c.id)).toContain(
            'harbor'
        );
        await expectHealthy();
        await expectTsc();

        res = await t.put('/api/stories/example/chapters/harbor', {
            version: res.body.version,
            title: { code: "_('Harbor')" },
            timeRange: { start: '6.1. 9:00', end: { code: "Time.fromString('8.1. 8:00')" } },
            children: [{ condition: 'always', chapterId: 'wedding' }],
            init: { boats: 3, names: ['a', 'b'] },
            dataType: { name: 'THarborChapterData', code: '{ boats: number; names: string[] }' },
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body).toMatchObject({
            title: { code: "_('Harbor')" },
            timeRange: { start: '6.1. 9:00', end: '8.1. 8:00' },
            children: [{ condition: 'always', chapterId: 'wedding' }],
            init: { boats: 3, names: ['a', 'b'] },
        });
        const chapterText = await read('data/chapters/harbor/harbor.chapter.ts');
        expect(chapterText).toContain("import { weddingChapter } from '../wedding/wedding.chapter';");
        expect(chapterText).toContain('chapter: weddingChapter');

        // a trigger in the new chapter (creates triggers.ts)
        res = await t.post('/api/stories/example/chapters/harbor/triggers', {
            triggerId: 'storm',
            name: 'Storm',
            time: '6.1. 12:00',
        });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        expect((await t.get('/api/stories/example/chapters/harbor')).body.triggerIds).toEqual(['storm']);

        // the new chapter's characters
        res = await t.post('/api/stories/example/chapters/harbor/characters', {
            characterId: 'annie',
            startPassageLocalId: 'dock',
        });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        expect(res.body.characters).toEqual([
            { characterId: 'annie', passageCount: 1, passageIds: ['harbor-annie-dock'] },
        ]);
        res = await t.post('/api/stories/example/chapters/harbor/passages', {
            characterId: 'annie',
            localId: 'ship',
            type: 'linear',
        });
        expect(res.status).toBe(201);
        await expectHealthy();
        await expectTsc();

        // a `redirect` is written like any other body field
        const palace = (await t.get('/api/stories/example/passages/kingdom-annie-palace')).body;
        res = await t.put('/api/stories/example/passages/kingdom-annie-palace', {
            version: palace.version,
            body: [{ ...palace.body[0], redirect: 'kingdom-annie-intro' }],
        });
        expect(res.status).toBe(200);
        expect(res.body.body[0].redirect).toBe('kingdom-annie-intro');

        // deleting the chapter is refused while something outside it points at its passages
        const annie = (await t.get('/api/stories/example/entities/characters/annie')).body;
        res = await t.put('/api/stories/example/entities/characters/annie', {
            version: annie.version,
            startPassageId: 'harbor-annie-dock',
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        let chapter = (await t.get('/api/stories/example/chapters/harbor')).body;
        res = await t.del('/api/stories/example/chapters/harbor', { version: chapter.version });
        expect(res.status).toBe(409);
        expect(res.body.references).toEqual([expect.objectContaining({ file: 'data/characters/annie.ts' })]);
        res = await t.put('/api/stories/example/entities/characters/annie', {
            version: (await t.get('/api/stories/example/entities/characters/annie')).body.version,
            startPassageId: 'kingdom-annie-intro',
        });
        expect(res.status).toBe(200);

        t.events.length = 0;
        chapter = (await t.get('/api/stories/example/chapters/harbor')).body;
        res = await t.del('/api/stories/example/chapters/harbor', { version: chapter.version });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(t.events).toEqual([
            { kind: 'chapter', id: 'harbor', chapterId: 'harbor', version: null, op: 'deleted' },
        ]);
        expect(exists('data/chapters/harbor')).toBe(false);
        expect(await read('data/register.ts')).not.toContain('harbor');
        expect(await read('data/TWorldState.ts')).not.toContain('arbor');
        expect((await t.get('/api/stories/example/chapters/harbor')).status).toBe(404);
        await expectHealthy();
        await expectTsc();
    }, 60_000);

    it('edits a chapter in place, keeping the rest of the file', async () => {
        const before = await read('data/chapters/kingdom/kingdom.chapter.ts');
        const kingdom = (await t.get('/api/stories/example/chapters/kingdom')).body;
        const res = await t.put('/api/stories/example/chapters/kingdom', {
            version: kingdom.version,
            timeRange: { start: '3.1. 8:00', end: '5.1. 8:00' },
        });
        expect(res.status).toBe(200);
        expect(await read('data/chapters/kingdom/kingdom.chapter.ts')).toBe(
            before.replace("start: Time.fromString('2.1. 8:00')", "start: Time.fromString('3.1. 8:00')")
        );
        // `TimeRange.fromString(a, b)` keeps its form
        const wedding = (await t.get('/api/stories/example/chapters/wedding')).body;
        const r2 = await t.put('/api/stories/example/chapters/wedding', {
            version: wedding.version,
            timeRange: { start: '5.1. 10:00', end: '6.1. 8:00' },
        });
        expect(r2.status).toBe(200);
        expect(await read('data/chapters/wedding/wedding.chapter.ts')).toContain(
            "TimeRange.fromString('5.1. 10:00', '6.1. 8:00')"
        );
        // bad bodies
        expect(
            (
                await t.put('/api/stories/example/chapters/kingdom', {
                    version: res.body.version,
                    children: [{ condition: 'x', chapterId: 'nope' }],
                })
            ).status
        ).toBe(400);
        expect(
            (await t.put('/api/stories/example/chapters/kingdom', { version: res.body.version, location: 'moon' }))
                .status
        ).toBe(422);
        expect(
            (
                await t.put('/api/stories/example/chapters/kingdom', {
                    version: res.body.version,
                    chapterId: 'x',
                    nonsense: 1,
                })
            ).status
        ).toBe(400);
        expect(
            (
                await t.post('/api/stories/example/chapters', {
                    chapterId: 'village',
                    title: 'x',
                    location: 'village',
                    timeRange: { start: '1.1. 0:00', end: '2.1. 0:00' },
                })
            ).status
        ).toBe(409);
        expect(
            (
                await t.post('/api/stories/example/chapters', {
                    chapterId: 'a-b',
                    title: 'x',
                    location: 'village',
                    timeRange: { start: '1.1. 0:00', end: '2.1. 0:00' },
                })
            ).status
        ).toBe(400);
        await expectTsc();
    }, 60_000);

    it('adds and removes a character in village (409 while referenced from outside)', async () => {
        let village = (await t.get('/api/stories/example/chapters/village')).body;
        // already in the chapter
        expect(
            (await t.post('/api/stories/example/chapters/village/characters', { characterId: 'thomas' })).status
        ).toBe(409);
        expect(
            (await t.post('/api/stories/example/chapters/village/characters', { characterId: 'nobody' })).status
        ).toBe(400);

        t.events.length = 0;
        let res = await t.post('/api/stories/example/chapters/village/characters', { characterId: 'annie' });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        expect(t.events).toHaveLength(1);
        expect(res.body.characters).toContainEqual({
            characterId: 'annie',
            passageCount: 1,
            passageIds: ['village-annie-intro'],
        });
        const passagesText = await read('data/chapters/village/village.passages.ts');
        expect(passagesText).toContain("export type TVillageAnniePassageId = 'village-annie-intro';");
        expect(passagesText).toContain(
            'export type TVillagePassageId = TVillageThomasPassageId | TVillageAnniePassageId;'
        );
        // both characters have an `intro`: the second import is aliased
        expect(passagesText).toContain("import { introPassage as annieIntroPassage } from './annie.passages/intro';");
        expect(passagesText).toContain("'village-annie-intro': annieIntroPassage,");
        expect(exists('data/chapters/village/annie.passages/intro.ts')).toBe(true);
        await expectHealthy();
        await expectTsc();

        // a passage of her own, then a link to it from kingdom → removing her is refused
        res = await t.post('/api/stories/example/chapters/village/passages', {
            characterId: 'annie',
            localId: 'well',
            type: 'transition',
        });
        expect(res.status).toBe(201);
        const other = (
            await t.post('/api/stories/example/chapters/kingdom/passages', {
                characterId: 'annie',
                localId: 'leave',
                type: 'transition',
            })
        ).body;
        res = await t.put('/api/stories/example/passages/kingdom-annie-leave', {
            version: other.version,
            nextPassageId: 'village-annie-well',
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);

        village = (await t.get('/api/stories/example/chapters/village')).body;
        expect(village.characters.find((c: { characterId: string }) => c.characterId === 'annie').passageCount).toBe(2);
        const before = await snapshot(t.project.root);
        res = await t.del('/api/stories/example/chapters/village/characters/annie', { version: village.version });
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('referenced');
        expect(res.body.references).toEqual([
            expect.objectContaining({
                file: 'data/chapters/kingdom/annie.passages/leave.ts',
                passageId: 'kingdom-annie-leave',
            }),
        ]);
        expect(changedFiles(before, await snapshot(t.project.root))).toEqual([]);
        // stale version
        expect((await t.del('/api/stories/example/chapters/village/characters/annie', { version: 'x' })).status).toBe(
            409
        );

        const leave = (await t.get('/api/stories/example/passages/kingdom-annie-leave')).body;
        expect(
            (await t.del('/api/stories/example/passages/kingdom-annie-leave', { version: leave.version })).status
        ).toBe(200);

        // with a saved layout position for one of her passages, which must go too
        await writeFile(
            path.join(t.project.root, 'data/chapters/village/village.layout.json'),
            JSON.stringify({
                passages: { 'village-annie-intro': { x: 1, y: 2 }, 'village-thomas-intro': { x: 3, y: 4 } },
            })
        );
        village = (await t.get('/api/stories/example/chapters/village')).body;
        t.events.length = 0;
        res = await t.del('/api/stories/example/chapters/village/characters/annie', { version: village.version });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(t.events).toHaveLength(1);
        expect(res.body.characters.map((c: { characterId: string }) => c.characterId)).toEqual(['thomas']);
        expect(exists('data/chapters/village/annie.passages')).toBe(false);
        const after = await read('data/chapters/village/village.passages.ts');
        expect(after).not.toContain('Annie');
        expect(after).not.toContain('annie');
        const layout = JSON.parse(await read('data/chapters/village/village.layout.json'));
        expect(layout.passages).toEqual({ 'village-thomas-intro': { x: 3, y: 4 } });
        await expectHealthy();
        await expectTsc();

        // thomas starts in village: removing him is refused
        village = (await t.get('/api/stories/example/chapters/village')).body;
        res = await t.del('/api/stories/example/chapters/village/characters/thomas', { version: village.version });
        expect(res.status).toBe(409);
        expect(res.body.references).toContainEqual(expect.objectContaining({ file: 'data/characters/thomas.ts' }));
    }, 60_000);

    it('restores village.passages.ts byte for byte after add + remove', async () => {
        const before = await snapshot(t.project.root);
        let res = await t.post('/api/stories/example/chapters/village/characters', { characterId: 'annie' });
        expect(res.status).toBe(201);
        res = await t.del('/api/stories/example/chapters/village/characters/annie', { version: res.body.version });
        expect(res.status).toBe(200);
        expect(changedFiles(before, await snapshot(t.project.root))).toEqual([]);
    });
});

describe('triggers', () => {
    it('creates, updates and deletes a trigger', async () => {
        let res = await t.post('/api/stories/example/chapters/kingdom/triggers', {
            triggerId: 'coronation',
            name: 'Coronation',
            time: '4.1. 12:00',
        });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        expect(res.body).toMatchObject({
            triggerId: 'coronation',
            chapterId: 'kingdom',
            name: 'Coronation',
            time: '4.1. 12:00',
        });
        expect(await read('data/chapters/kingdom/kingdom.chapter.ts')).toContain('triggers: [coronationTrigger]');
        expect(
            (
                await t.post('/api/stories/example/chapters/village/triggers', {
                    triggerId: 'coronation',
                    name: 'x',
                    time: '1.1. 0:00',
                })
            ).status
        ).toBe(409);
        await expectTsc();

        res = await t.put('/api/stories/example/triggers/coronation', {
            version: res.body.version,
            name: 'The coronation',
            time: '4.1. 13:00',
            condition: { code: '() => Math.random() > 0.5' },
            action: { code: "() => {\n    console.log('crowned');\n}" },
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body).toMatchObject({
            name: 'The coronation',
            time: '4.1. 13:00',
            condition: { code: '() => Math.random() > 0.5' },
        });
        expect(
            (
                await t.put('/api/stories/example/triggers/coronation', {
                    version: res.body.version,
                    condition: { code: '() => 5' },
                })
            ).status
        ).toBe(422);

        // the village trigger lives in another file: its version is independent
        const village = (await t.get('/api/stories/example/triggers/nobleHouseRobbery')).body;
        expect(
            (
                await t.put('/api/stories/example/triggers/nobleHouseRobbery', {
                    version: village.version,
                    name: 'Robbery',
                })
            ).status
        ).toBe(200);

        res = await t.del('/api/stories/example/triggers/coronation', { version: res.body.version });
        expect(res.status).toBe(200);
        expect(await read('data/chapters/kingdom/kingdom.chapter.ts')).toContain('triggers: []');
        expect(await read('data/chapters/kingdom/kingdom.chapter.ts')).not.toContain('coronation');
        expect(await read('data/chapters/kingdom/triggers.ts')).not.toContain('coronation');
        expect((await t.get('/api/stories/example/triggers/coronation')).status).toBe(404);
        await expectTsc();
    }, 60_000);
});

describe('entities', () => {
    it('creates, updates and deletes characters, npcs and locations', async () => {
        let res = await t.post('/api/stories/example/entities/characters', {
            id: 'bob',
            name: 'Bob',
            init: { health: 50, inventory: [{ id: 'gold', amount: 3 }] },
        });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        expect(res.body).toMatchObject({
            id: 'bob',
            file: 'data/characters/bob.ts',
            exportName: 'Bob',
            init: { health: 50 },
        });
        expect(await read('data/register.ts')).toContain('bob: Bob');
        expect(await read('data/TWorldState.ts')).toContain(
            "bob: { ref: TCharacter<'bob'> } & TCharacterData & Partial<TBobCharacterData>;"
        );
        res = await t.put('/api/stories/example/entities/characters/bob', {
            version: res.body.version,
            description: 'A builder',
            dataType: { name: 'TBobCharacterData', code: '{ canBuild: boolean }' },
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.dataType).toEqual({ name: 'TBobCharacterData', code: '{ canBuild: boolean }' });
        // an init that does not fit the type is a 422
        const bad = await t.put('/api/stories/example/entities/characters/bob', {
            version: res.body.version,
            init: { ...res.body.init, health: 'full' },
        });
        expect(bad.status).toBe(422);
        expect(bad.body.diagnostics[0].field).toBe('init.health');
        expect((await t.post('/api/stories/example/entities/characters', { id: 'bob' })).status).toBe(409);

        res = await t.post('/api/stories/example/entities/npcs', {
            id: 'smith',
            name: 'Smith',
            description: 'Makes swords',
        });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        expect(res.body.file).toBe('data/npcs/Smith.ts');

        res = await t.post('/api/stories/example/entities/locations', {
            id: 'forest',
            name: 'Forest',
            localCharacters: [{ name: 'Owl', description: 'Wise' }],
        });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        const village = (await t.get('/api/stories/example/entities/locations/village')).body;
        res = await t.put('/api/stories/example/entities/locations/village', {
            version: village.version,
            sublocations: ['forest'],
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.sublocations).toEqual(['forest']);
        await expectHealthy();
        await expectTsc();

        // forest is referenced (village.sublocations): refused
        let forest = (await t.get('/api/stories/example/entities/locations/forest')).body;
        res = await t.del('/api/stories/example/entities/locations/forest', { version: forest.version });
        expect(res.status).toBe(409);
        expect(res.body.references).toEqual([expect.objectContaining({ file: 'data/locations/village.location.ts' })]);
        res = await t.put('/api/stories/example/entities/locations/village', {
            version: (await t.get('/api/stories/example/entities/locations/village')).body.version,
            sublocations: null,
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        forest = (await t.get('/api/stories/example/entities/locations/forest')).body;
        expect(
            (await t.del('/api/stories/example/entities/locations/forest', { version: forest.version })).status
        ).toBe(200);
        // the village location is used as `location: 'village'` all over the story: type-level references
        const v = (await t.get('/api/stories/example/entities/locations/village')).body;
        res = await t.del('/api/stories/example/entities/locations/village', { version: v.version });
        expect(res.status).toBe(409);
        expect(res.body.references.map((r: { file: string }) => r.file)).toEqual(
            expect.arrayContaining(['data/chapters/village/village.chapter.ts', 'data/characters/thomas.ts'])
        );
        // thomas has passage folders
        const thomas = (await t.get('/api/stories/example/entities/characters/thomas')).body;
        expect(
            (await t.del('/api/stories/example/entities/characters/thomas', { version: thomas.version })).status
        ).toBe(409);

        for (const [kind, id] of [
            ['characters', 'bob'],
            ['npcs', 'smith'],
        ]) {
            const e = (await t.get(`/api/stories/example/entities/${kind}/${id}`)).body;
            res = await t.del(`/api/stories/example/entities/${kind}/${id}`, { version: e.version });
            expect(res.status, JSON.stringify(res.body)).toBe(200);
        }
        expect(exists('data/characters/bob.ts')).toBe(false);
        expect(await read('data/register.ts')).not.toMatch(/bob|Bob|smith|Smith|forest/);
        expect(await read('data/TWorldState.ts')).not.toMatch(/bob|Bob|smith|Smith|forest|Forest/);
        await expectHealthy();
        await expectTsc();
    }, 60_000);

    it('creates, updates, moves and deletes items in the file their type picks', async () => {
        let res = await t.post('/api/stories/example/entities/items', {
            id: 'apple',
            type: 'food',
            name: 'Apple',
            props: { hungerValue: 3 },
        });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        expect(res.body).toMatchObject({
            source: 'foodInfo',
            file: 'data/items/foodInfo.ts',
            props: { hungerValue: 3 },
        });
        // foodInfo's own type wants a hungerValue
        expect(
            (await t.post('/api/stories/example/entities/items', { id: 'pear', type: 'food', name: 'Pear' })).status
        ).toBe(422);
        const bow0 = (await t.get('/api/stories/example/entities/items/bow')).body;
        const badBow = await t.put('/api/stories/example/entities/items/bow', {
            version: bow0.version,
            props: { ...bow0.props, damage: { code: 'undefinedThing' } },
        });
        expect(badBow.status).toBe(422);
        expect(badBow.body.diagnostics[0].field).toBe('props.damage');
        res = await t.post('/api/stories/example/entities/items', { id: 'rope', type: 'resource', name: 'Rope' });
        expect(res.status).toBe(201);
        expect(res.body.source).toBe('itemInfo');

        const bow = (await t.get('/api/stories/example/entities/items/bow')).body;
        res = await t.put('/api/stories/example/entities/items/bow', {
            version: bow.version,
            props: { ...bow.props, damage: 12, range: 30 },
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.props).toEqual({ damage: 12, asd: { asd: 'asdas', time: false }, range: 30 });

        // rope becomes a tool: it moves to toolInfo.ts
        const rope = (await t.get('/api/stories/example/entities/items/rope')).body;
        res = await t.put('/api/stories/example/entities/items/rope', { version: rope.version, type: 'tool' });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body).toMatchObject({ source: 'toolInfo', type: 'tool', name: 'Rope' });
        expect(await read('data/items/itemInfo.ts')).not.toContain('rope');
        await expectTsc();

        // bow is in thomas's inventory
        const bow2 = (await t.get('/api/stories/example/entities/items/bow')).body;
        res = await t.del('/api/stories/example/entities/items/bow', { version: bow2.version });
        expect(res.status).toBe(409);
        expect(res.body.references).toContainEqual(expect.objectContaining({ file: 'data/characters/thomas.ts' }));
        for (const id of ['apple', 'rope']) {
            const e = (await t.get(`/api/stories/example/entities/items/${id}`)).body;
            expect((await t.del(`/api/stories/example/entities/items/${id}`, { version: e.version })).status).toBe(200);
        }
        expect((await t.get('/api/stories/example/entities/items/apple')).status).toBe(404);
        await expectTsc();
    }, 60_000);

    it('adds a missing name to an item on update', async () => {
        const file = path.join(t.project.root, 'data/items/itemInfo.ts');
        await writeFile(file, (await read('data/items/itemInfo.ts')).replace("name: 'Wood',", ''));
        const wood = (await t.get('/api/stories/example/entities/items/wood')).body;
        expect(wood.name).toBe('wood');
        const res = await t.put('/api/stories/example/entities/items/wood', { version: wood.version, name: 'Timber' });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Timber');
        expect(await read('data/items/itemInfo.ts')).toMatch(/wood: \{\s*name: 'Timber',\s*type: 'resource'/);
    });
});
