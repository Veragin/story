import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TChangeEvent, TMapDto, TMapFile } from '@story/visualizer-protocol';
import { createApp, type TApp } from '../src/app';
import type { TServerContext } from '../src/context';
import {
    createDefaultMap,
    decodeMapFile,
    encodeMapFile,
    removeChapterLayout,
    removeLocationPolygon,
    removePassagePositions,
    removeTimelineEntries,
} from '../src/json';
import { listenLocal, login, makeTempProject } from './helpers';

let app: TApp;
let story: TServerContext;
let base: string;
let cleanup: () => Promise<void>;
let events: TChangeEvent[] = [];
let cookie: string;

beforeAll(async () => {
    const temp = await makeTempProject();
    cleanup = temp.cleanup;
    app = await createApp({ storiesRoot: temp.storiesRoot, watch: false, batchMs: 20 });
    story = await app.story('example');
    story.bus.subscribe((e) => events.push(e));
    base = await listenLocal(app);
    cookie = await login(base);
});

afterAll(async () => {
    await app.close();
    await cleanup();
});

beforeEach(async () => {
    events = [];
    const { paths } = story.project;
    await rm(paths.map, { force: true });
    await rm(paths.timelineLayout, { force: true });
    await rm(paths.chapterLayout('village'), { force: true });
});

const call = async <T = Record<string, unknown>>(method: string, route: string, body?: unknown) => {
    const res = await fetch(base + route, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    });
    return { status: res.status, json: (await res.json()) as T };
};

const exists = async (file: string) => {
    try {
        await stat(file);
        return true;
    } catch {
        return false;
    }
};

/** Every feature: runs, a label, a description, polygons, a sub-map. */
const sampleMap = (): TMapFile => {
    const map = createDefaultMap('global', { title: 'World', width: 6, height: 3 });
    map.data[0] = map.data[0].map(() => ({ tile: 'water' }));
    map.data[1][2] = { tile: 'city', label: 'Village', description: 'A few houses.' };
    map.data[2][5] = { tile: 'grass', label: 'Hill' };
    map.locations = {
        village: {
            polygon: [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
                { x: 5, y: 0 },
            ],
            fill: '#ff000055',
        },
        kingdom: {
            polygon: [
                { x: 10, y: 20 },
                { x: 30, y: 40 },
                { x: 50, y: 0 },
            ],
        },
    };
    map.maps = [{ i: 1, j: 2, mapId: 'cave' }];
    return map;
};

describe('map store', () => {
    it('GET answers an empty map of the story\'s mapSize with version "" while map.json is missing', async () => {
        const { status, json } = await call<TMapDto>('GET', '/api/stories/example/maps/global');
        expect(status).toBe(200);
        expect(json.version).toBe('');
        expect(json).toMatchObject({
            mapId: 'global',
            title: 'Untitled',
            width: 80,
            height: 60,
            locations: {},
            maps: [],
        });
        expect(json.data).toHaveLength(60);
        expect(json.data[0]).toHaveLength(80);
        expect(json.data[0][0]).toEqual({ tile: 'none' });
        expect(Object.keys(json.palette)).toEqual([
            'none',
            'grass',
            'water',
            'sand',
            'forest',
            'mountain',
            'snow',
            'lava',
            'city',
            'road',
        ]);
        expect(await exists(story.project.paths.map)).toBe(false);
    });

    it('404s any map id but global', async () => {
        expect((await call('GET', '/api/stories/example/maps/other')).status).toBe(404);
        expect(
            (await call('PUT', '/api/stories/example/maps/other', { ...sampleMap(), mapId: 'other', version: '' }))
                .status
        ).toBe(404);
    });

    it('creates with version "", updates with the current version, one event each', async () => {
        const created = await call<TMapDto>('PUT', '/api/stories/example/maps/global', { ...sampleMap(), version: '' });
        expect(created.status).toBe(200);
        expect(created.json.version).not.toBe('');
        const { version: _v, ...createdFile } = created.json;
        void _v;
        expect(createdFile).toEqual({
            ...sampleMap(),
            locations: { kingdom: sampleMap().locations.kingdom, village: sampleMap().locations.village },
        });
        expect(events).toEqual([{ kind: 'map', id: 'global', version: created.json.version, op: 'created' }]);

        const got = await call<TMapDto>('GET', '/api/stories/example/maps/global');
        expect(got.json).toEqual(created.json);

        const next = { ...created.json, title: 'World 2' };
        const updated = await call<TMapDto>('PUT', '/api/stories/example/maps/global', next);
        expect(updated.status).toBe(200);
        expect(updated.json.title).toBe('World 2');
        expect(updated.json.version).not.toBe(created.json.version);
        expect(events).toHaveLength(2);
        expect(events[1]).toEqual({ kind: 'map', id: 'global', version: updated.json.version, op: 'updated' });
    });

    it('409 stale on a version mismatch, carrying the current map, and writes nothing', async () => {
        const created = await call<TMapDto>('PUT', '/api/stories/example/maps/global', { ...sampleMap(), version: '' });
        const before = await readFile(story.project.paths.map, 'utf8');

        const again = await call('PUT', '/api/stories/example/maps/global', { ...sampleMap(), version: '' });
        expect(again.status).toBe(409);
        expect(again.json).toMatchObject({
            error: 'stale',
            current: { version: created.json.version, title: 'World' },
        });

        const old = await call('PUT', '/api/stories/example/maps/global', {
            ...sampleMap(),
            title: 'X',
            version: 'deadbeef',
        });
        expect(old.status).toBe(409);
        expect(await readFile(story.project.paths.map, 'utf8')).toBe(before);
        expect(events).toHaveLength(1);
    });

    it('stale when creating over nothing with a non-empty version', async () => {
        const res = await call('PUT', '/api/stories/example/maps/global', { ...sampleMap(), version: 'abc' });
        expect(res.status).toBe(409);
        expect(res.json).toMatchObject({ error: 'stale', current: { version: '', title: 'Untitled' } });
    });

    it.each<[string, (m: Record<string, unknown>) => void]>([
        ['missing data', (m) => delete m.data],
        ['wrong row count', (m) => (m.height = 4)],
        ['wrong column count', (m) => (m.width = 7)],
        ['non-string tile', (m) => ((m.data as { tile: unknown }[][])[0][0].tile = 3)],
        ['tile id with a space', (m) => ((m.data as { tile: unknown }[][])[0][0].tile = 'deep water')],
        [
            'palette id with a "*"',
            (m) => ((m.palette as Record<string, unknown>)['a*b'] = { name: 'x', color: '#000' }),
        ],
        ['bad polygon point', (m) => ((m.locations as Record<string, unknown>).x = { polygon: [{ x: 'a', y: 1 }] })],
        ['unknown field', (m) => (m.extra = 1)],
        ['mapId not the url one', (m) => (m.mapId = 'other')],
    ])('400 on a bad shape: %s', async (_name, spoil) => {
        const body = { ...structuredClone(sampleMap()), version: '' } as Record<string, unknown>;
        spoil(body);
        const res = await call('PUT', '/api/stories/example/maps/global', body);
        expect(res.status).toBe(400);
        expect(res.json.error).toBe('bad_request');
        expect(await exists(story.project.paths.map)).toBe(false);
        expect(events).toEqual([]);
    });

    it('422 on a broken map.json', async () => {
        await writeFile(story.project.paths.map, '{"tiles": 3');
        expect((await call('GET', '/api/stories/example/maps/global')).status).toBe(422);
        await writeFile(
            story.project.paths.map,
            JSON.stringify({ mapId: 'global', title: '', width: 2, height: 1, palette: {}, tiles: ['a'] })
        );
        const res = await call('GET', '/api/stories/example/maps/global');
        expect(res.status).toBe(422);
        expect(String(res.json.message)).toContain('tiles[0]');
    });

    it('map.json is compact, sorted and prettier-clean; a one-tile edit is a one-line diff', async () => {
        const text = await encodeMapFile(sampleMap());
        expect(text).toBe(await format(text, { parser: 'json', tabWidth: 4, printWidth: 80 }));
        const json = JSON.parse(text) as Record<string, unknown>;
        expect(json.tiles).toEqual(['water*6', 'none*2 city none*3', 'none*5 grass']);
        expect(json.tileText).toEqual({
            '1,2': { label: 'Village', description: 'A few houses.' },
            '2,5': { label: 'Hill' },
        });
        expect(Object.keys(json.locations as object)).toEqual(['kingdom', 'village']);
        expect(text).toContain('{ "x": 1, "y": 2 }');
        expect(decodeMapFile(json)).toEqual({ ...sampleMap(), locations: json.locations });

        const edited = sampleMap();
        edited.data[1][4] = { tile: 'forest' };
        const a = text.split('\n');
        const b = (await encodeMapFile(edited)).split('\n');
        expect(b).toHaveLength(a.length);
        expect(a.filter((line, k) => line !== b[k])).toHaveLength(1);

        const big = await encodeMapFile(createDefaultMap());
        expect(big.split('\n').filter((l) => l.includes('"none*100"'))).toHaveLength(100);
    });

    it('reads a hand-written map.json in the API shape', async () => {
        const { data, ...rest } = sampleMap();
        await writeFile(story.project.paths.map, JSON.stringify({ ...rest, data }));
        const res = await call<TMapDto>('GET', '/api/stories/example/maps/global');
        expect(res.status).toBe(200);
        expect(res.json.data[1][2]).toEqual({ tile: 'city', label: 'Village', description: 'A few houses.' });
    });
});

describe('layout stores', () => {
    it('timeline: empty with version "" when missing, then create / update / stale / 400', async () => {
        const empty = await call('GET', '/api/stories/example/layout/timeline');
        expect(empty).toEqual({ status: 200, json: { chapters: {}, triggers: {}, version: '' } });

        const doc = { chapters: { village: { y: 120 }, kingdom: { y: 40 } }, triggers: { bell: { y: -3 }, dawn: {} } };
        const created = await call<Record<string, unknown> & { version: string }>(
            'PUT',
            '/api/stories/example/layout/timeline',
            {
                ...doc,
                version: '',
            }
        );
        expect(created.status).toBe(200);
        expect(created.json).toEqual({ ...doc, version: created.json.version });
        expect(events).toEqual([{ kind: 'layout', id: 'timeline', version: created.json.version, op: 'created' }]);
        const text = await readFile(story.project.paths.timelineLayout, 'utf8');
        expect(text).toBe(
            [
                '{',
                '    "chapters": {',
                '        "kingdom": { "y": 40 },',
                '        "village": { "y": 120 }',
                '    },',
                '    "triggers": {',
                '        "bell": { "y": -3 },',
                '        "dawn": {}',
                '    }',
                '}',
                '',
            ].join('\n')
        );

        const stale = await call('PUT', '/api/stories/example/layout/timeline', { ...doc, version: '' });
        expect(stale.status).toBe(409);
        expect(stale.json).toMatchObject({ error: 'stale', current: { version: created.json.version } });

        const bad = await call('PUT', '/api/stories/example/layout/timeline', {
            chapters: { village: { y: 'x' } },
            triggers: {},
            version: created.json.version,
        });
        expect(bad.status).toBe(400);
        expect(String(bad.json.message)).toContain('chapters.village.y');

        const updated = await call<{ version: string }>('PUT', '/api/stories/example/layout/timeline', {
            chapters: {},
            triggers: {},
            version: created.json.version,
        });
        expect(updated.status).toBe(200);
        expect(events).toHaveLength(2);
        expect(events[1]).toMatchObject({
            kind: 'layout',
            id: 'timeline',
            op: 'updated',
            version: updated.json.version,
        });
    });

    it('chapter: 404 for an unknown chapter, empty when missing, create writes sorted keys', async () => {
        expect((await call('GET', '/api/stories/example/layout/chapters/nope')).status).toBe(404);
        expect(
            (await call('PUT', '/api/stories/example/layout/chapters/nope', { passages: {}, version: '' })).status
        ).toBe(404);
        expect(await call('GET', '/api/stories/example/layout/chapters/village')).toEqual({
            status: 200,
            json: { chapterId: 'village', passages: {}, version: '' },
        });

        const passages = { 'village-thomas-intro': { x: 10, y: 20 }, 'village-thomas-cool': { x: 0.5, y: -1 } };
        const created = await call<{ version: string }>('PUT', '/api/stories/example/layout/chapters/village', {
            passages,
            version: '',
        });
        expect(created.status).toBe(200);
        expect(created.json).toEqual({ chapterId: 'village', passages, version: created.json.version });
        expect(events).toEqual([
            {
                kind: 'layout',
                id: 'chapters/village',
                chapterId: 'village',
                version: created.json.version,
                op: 'created',
            },
        ]);
        expect(await readFile(story.project.paths.chapterLayout('village'), 'utf8')).toBe(
            '{\n    "passages": {\n' +
                '        "village-thomas-cool": { "x": 0.5, "y": -1 },\n' +
                '        "village-thomas-intro": { "x": 10, "y": 20 }\n    }\n}\n'
        );
        const bad = await call('PUT', '/api/stories/example/layout/chapters/village', {
            passages: { a: { x: 1 } },
            version: created.json.version,
        });
        expect(bad.status).toBe(400);
        const stale = await call('PUT', '/api/stories/example/layout/chapters/village', {
            passages: {},
            version: 'old',
        });
        expect(stale.status).toBe(409);
        expect(events).toHaveLength(1);
    });

    it('hand edits of the JSON stores map to map / layout events', async () => {
        const { paths } = story.project;
        await mkdir(path.dirname(paths.map), { recursive: true });
        await writeFile(paths.map, await encodeMapFile({ ...sampleMap(), title: 'Hand edit' }));
        await writeFile(paths.chapterLayout('village'), '{ "passages": {} }\n');
        await writeFile(paths.timelineLayout, '{ "chapters": {}, "triggers": {} }\n');
        story.bus.fileChanged(paths.map, 'add');
        story.bus.fileChanged(paths.chapterLayout('village'), 'add');
        story.bus.fileChanged(paths.timelineLayout, 'change');
        await story.bus.settle();
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: 'map', id: 'global', op: 'created' }),
                expect.objectContaining({
                    kind: 'layout',
                    id: 'chapters/village',
                    chapterId: 'village',
                    op: 'created',
                }),
                expect.objectContaining({ kind: 'layout', id: 'timeline', op: 'updated' }),
            ])
        );
        expect(events).toHaveLength(3);
    });
});

describe('cleanup helpers (inside a caller transaction)', () => {
    it('remove passage positions, polygons, timeline entries and chapter layouts; emit only the caller event', async () => {
        const { paths } = story.project;
        await call('PUT', '/api/stories/example/layout/chapters/village', {
            passages: { 'village-thomas-intro': { x: 1, y: 1 }, 'village-thomas-cool': { x: 2, y: 2 } },
            version: '',
        });
        await call('PUT', '/api/stories/example/maps/global', { ...sampleMap(), version: '' });
        await call('PUT', '/api/stories/example/layout/timeline', {
            chapters: { village: { y: 1 }, kingdom: { y: 2 } },
            triggers: { bell: { y: 3 } },
            version: '',
        });
        events = [];

        const results = await story.bus.transaction(async (tx) => {
            const r = [
                await removePassagePositions(tx, 'village', ['village-thomas-cool', 'village-thomas-nope']),
                await removePassagePositions(tx, 'village', ['village-thomas-nope']),
                await removePassagePositions(tx, 'kingdom', ['kingdom-annie-intro']), // no file
                await removeLocationPolygon(tx, 'village'),
                await removeLocationPolygon(tx, 'village'),
                await removeTimelineEntries(tx, { chapters: ['village'], triggers: ['bell', 'nope'] }),
                await removeTimelineEntries(tx, { chapters: ['village'] }),
            ];
            tx.setEvent({
                kind: 'passage',
                id: 'village-thomas-cool',
                version: null,
                op: 'deleted',
                chapterId: 'village',
            });
            return r;
        });
        expect(results).toEqual([true, false, false, true, false, true, false]);
        expect(events).toEqual([
            { kind: 'passage', id: 'village-thomas-cool', version: null, op: 'deleted', chapterId: 'village' },
        ]);

        expect((await call('GET', '/api/stories/example/layout/chapters/village')).json.passages).toEqual({
            'village-thomas-intro': { x: 1, y: 1 },
        });
        expect(Object.keys((await call<TMapDto>('GET', '/api/stories/example/maps/global')).json.locations)).toEqual([
            'kingdom',
        ]);
        expect((await call('GET', '/api/stories/example/layout/timeline')).json).toMatchObject({
            chapters: { kingdom: { y: 2 } },
            triggers: {},
        });

        const removed = await story.bus.transaction(async (tx) => [
            await removeChapterLayout(tx, 'village'),
            await removeChapterLayout(tx, 'village'),
        ]);
        expect(removed).toEqual([true, false]);
        expect(await exists(paths.chapterLayout('village'))).toBe(false);
        expect(events).toHaveLength(1); // the second transaction set no event
    });

    it('a no-op helper on a missing map.json does not create it', async () => {
        const r = await story.bus.transaction((tx) => removeLocationPolygon(tx, 'village'));
        expect(r).toBe(false);
        expect(await exists(story.project.paths.map)).toBe(false);
    });
});
