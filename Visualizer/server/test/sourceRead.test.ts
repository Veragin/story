import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { changedFiles, snapshot, startSourceApp, storyProblems, tscTemp } from './sourceHelpers';

/**
 * Readers (plan WP2): what the server makes of the committed story, and the round-trip rule —
 * reading a resource and writing it back unchanged leaves every file byte-identical.
 */
let t: Awaited<ReturnType<typeof startSourceApp>>;

beforeAll(async () => {
    t = await startSourceApp();
});
afterAll(async () => {
    await t.close();
});

describe('readers', () => {
    it('the temp copy type-checks and passes the reference checks before anything is written', async () => {
        const tsc = await tscTemp(t.project.root);
        expect(tsc.output).toBe('');
        expect(tsc.ok).toBe(true);
        expect(await storyProblems(t.project.root)).toEqual([]);
    }, 60_000);

    it('lists the project', async () => {
        const { status, body } = await t.get('/api/stories/example/project');
        expect(status).toBe(200);
        expect(body.version).toMatch(/^[0-9a-f]{16}$/);
        expect(body.chapters.map((c: { id: string }) => c.id)).toEqual(['village', 'kingdom', 'wedding']);
        expect(body.chapters[1]).toMatchObject({
            id: 'kingdom',
            characterIds: ['annie', 'thomas'],
            childIds: ['village'],
        });
        expect(body.chapters[2].name).toBe('Wedding Chapter'); // from `_('Wedding Chapter')`
        expect(body.triggers).toEqual([{ id: 'nobleHouseRobbery', chapterId: 'village', name: 'Noble house robbery' }]);
        expect(body.items.map((i: { id: string }) => i.id).sort()).toEqual(['axe', 'berries', 'bow', 'gold', 'wood']);
        expect(body.locations.find((l: { id: string }) => l.id === 'kingdom').name).toBe('kingdom');
    });

    it('reads a chapter, with code fields as text', async () => {
        const village = (await t.get('/api/stories/example/chapters/village')).body;
        expect(village).toMatchObject({
            chapterId: 'village',
            file: 'data/chapters/village/village.chapter.ts',
            exportName: 'villageChapter',
            title: 'Village Chapter',
            timeRange: { start: '2.1. 8:00', end: '5.1. 8:00' },
            location: 'village',
            triggerIds: ['nobleHouseRobbery'],
            init: { mojePromena: { time: 0, asd: 'asd' } },
            dataType: { name: 'TVillageChapterData' },
            characters: [
                {
                    characterId: 'thomas',
                    passageCount: 3,
                    passageIds: ['village-thomas-cool', 'village-thomas-forest', 'village-thomas-intro'],
                },
            ],
        });
        const wedding = (await t.get('/api/stories/example/chapters/wedding')).body;
        expect(wedding.title).toEqual({ code: "_('Wedding Chapter')" });
        expect(wedding.timeRange).toEqual({ start: '5.1. 9:00', end: '6.1. 8:00' });
        const kingdom = (await t.get('/api/stories/example/chapters/kingdom')).body;
        expect(kingdom.children).toEqual([{ condition: 'asdasd', chapterId: 'village' }]);
        expect((await t.get('/api/stories/example/chapters/nope')).status).toBe(404);
    });

    it('reads passages with statically extracted edges', async () => {
        const { body } = await t.get('/api/stories/example/chapters/village/passages');
        expect(body.passages.map((p: { passageId: string }) => p.passageId)).toEqual([
            'village-thomas-cool',
            'village-thomas-forest',
            'village-thomas-intro',
        ]);
        const forest = body.passages[1];
        expect(forest.body[0].links[0].cost).toEqual({
            code: 's.time.s < 10 ? DeltaTime.fromMin(1) : DeltaTime.fromMin(2)',
        });
        expect(body.passages[0]).toMatchObject({
            type: 'transition',
            exportName: 'default',
            nextPassageId: 'village-thomas-',
        });
        expect(body.edges).toEqual(
            expect.arrayContaining([
                {
                    from: 'village-thomas-cool',
                    to: 'village-thomas-',
                    kind: 'next',
                    conditional: false,
                    resolved: false,
                },
                {
                    from: 'village-thomas-intro',
                    to: 'village-thomas-forest',
                    kind: 'link',
                    conditional: false,
                    resolved: true,
                },
            ])
        );
        const visit = (await t.get('/api/stories/example/passages/kingdom-thomas-visit')).body;
        expect(visit).toMatchObject({
            params: ['s', 'e'],
            preamble: 'void s;\nvoid e;',
            title: { code: "_('visit')" },
        });
        expect(visit.body[0].links[0].cost).toEqual({ seconds: 600 });
        const annie = (await t.get('/api/stories/example/passages/kingdom-annie-intro')).body;
        expect(annie.body[0].condition).toEqual({ code: 's.characters.annie.health > 0' });
        expect(annie.body[0].links[0].cost).toEqual({ time: { seconds: 600 }, items: [{ id: 'berries', amount: 1 }] });
        const forestDto = (await t.get('/api/stories/example/passages/village-thomas-forest')).body;
        expect(forestDto.execute).toEqual({
            code: expect.stringContaining('s.characters.annie.health += 50;'),
            description: 'Annie gets healed when she is weak.',
        });
        expect(forestDto.execute.code).toMatch(/^\(\) => \{/);
        expect(forestDto.body[0].condition).toEqual({ code: 'true' });
        expect((await t.get('/api/stories/example/passages/village-thomas-nope')).status).toBe(404);
    });

    it('finds edges inside code fields, marked conditional', async () => {
        // a conditional link target, written by hand (the watcher is off: the next request re-syncs)
        const { writeFile, readFile } = await import('node:fs/promises');
        const file = `${t.project.root}/data/chapters/village/thomas.passages/intro.ts`;
        const before = await readFile(file, 'utf8');
        await writeFile(
            file,
            before.replace(
                "passageId: 'village-thomas-forest'",
                "passageId: Math.random() > 0.5 ? 'village-thomas-forest' : 'village-thomas-cool'"
            )
        );
        const { body } = await t.get('/api/stories/example/chapters/village/passages');
        expect(body.edges.filter((e: { from: string }) => e.from === 'village-thomas-intro')).toEqual([
            {
                from: 'village-thomas-intro',
                to: 'village-thomas-forest',
                kind: 'link',
                conditional: true,
                resolved: true,
            },
            {
                from: 'village-thomas-intro',
                to: 'village-thomas-cool',
                kind: 'link',
                conditional: true,
                resolved: true,
            },
        ]);
        await writeFile(file, before);
    });

    it('reads triggers and entities', async () => {
        const trigger = (await t.get('/api/stories/example/triggers/nobleHouseRobbery')).body;
        expect(trigger).toMatchObject({ name: 'Noble house robbery', time: '1.12 0:0', action: { code: '() => {}' } });
        expect(trigger.condition.code).toContain('return true;');
        const items = (await t.get('/api/stories/example/entities/items')).body.entities;
        expect(items.find((i: { id: string }) => i.id === 'berries')).toMatchObject({
            source: 'foodInfo',
            file: 'data/items/foodInfo.ts',
            type: 'food',
            props: { hungerValue: 5 },
        });
        const village = (await t.get('/api/stories/example/entities/locations/village')).body;
        expect(village.localCharacters).toEqual([{ name: 'Pepa', description: 'Pepa is a very smart' }]);
        const franta = (await t.get('/api/stories/example/entities/npcs/franta')).body;
        expect(franta).toMatchObject({
            file: 'data/npcs/Franta.ts',
            exportName: 'Franta',
            init: { inventory: [], isDead: false },
        });
        expect((await t.get('/api/stories/example/entities/things/x')).status).toBe(404);
    });
});

describe('round trip', () => {
    it('reading and writing back every resource unchanged leaves every file byte-identical', async () => {
        const before = await snapshot(t.project.root);
        const project = (await t.get('/api/stories/example/project')).body;
        const puts: [string, unknown][] = [];
        for (const c of project.chapters) {
            puts.push([
                `/api/stories/example/chapters/${c.id}`,
                (await t.get(`/api/stories/example/chapters/${c.id}`)).body,
            ]);
            for (const p of (await t.get(`/api/stories/example/chapters/${c.id}/passages`)).body.passages) {
                puts.push([`/api/stories/example/passages/${p.passageId}`, p]);
            }
        }
        for (const tr of project.triggers)
            puts.push([
                `/api/stories/example/triggers/${tr.id}`,
                (await t.get(`/api/stories/example/triggers/${tr.id}`)).body,
            ]);
        for (const kind of ['characters', 'npcs', 'locations', 'items']) {
            for (const e of (await t.get(`/api/stories/example/entities/${kind}`)).body.entities)
                puts.push([`/api/stories/example/entities/${kind}/${e.id}`, e]);
        }
        expect(puts.length).toBeGreaterThan(15);
        for (const [url, dto] of puts) {
            const res = await t.put(url, dto);
            expect(res.status, url).toBe(200);
            expect(res.body.version, url).toBe((dto as { version: string }).version);
        }
        expect(changedFiles(before, await snapshot(t.project.root))).toEqual([]);
    });
});
