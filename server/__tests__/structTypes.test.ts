import { access, readFile, writeFile } from 'node:fs/promises';
import { refTarget } from '@story/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TAny } from './helpers/http';
import { startSourceApp, tscTemp } from './helpers/sourceHelpers';

let t: Awaited<ReturnType<typeof startSourceApp>>;

const STORY = '/api/stories/example';
const API = `${STORY}/structure`;
const ENTRIES = `${STORY}/catalogs/squads`;
const VILLAGE = 'data/chapters/village/village.chapter.ts';

beforeAll(async () => {
    t = await startSourceApp();
});
afterAll(async () => {
    await t.close();
});

const read = (file: string) => readFile(t.project.abs(file), 'utf8');

const exists = async (file: string) => {
    try {
        await access(t.project.abs(file));
        return true;
    } catch {
        return false;
    }
};

const handEdit = async (file: string, from: string, to: string) => {
    const text = await read(file);
    expect(text, file).toContain(from);
    await writeFile(t.project.abs(file), text.replace(from, to));
};

const structure = async () => (await t.get(API)).body;

const typeNamed = async (name: string) => (await structure()).types.find((type: TAny) => type.name === name);

const updateType = async (name: string, change: (fields: TAny[]) => TAny[], extra: Record<string, unknown> = {}) => {
    const type = await typeNamed(name);
    return t.put(`${API}/types/${name}`, { version: type.version, fields: change(type.fields), ...extra });
};

const expectTsc = async () => {
    const tsc = await tscTemp(t.project.root);
    expect(tsc.output).toBe('');
};

const DATA = { t: 'struct', name: 'TData' };

describe('struct types: class A { ch: TCharacterId; d: TData }', () => {
    it('creates a type without a catalog', async () => {
        const created = await t.post(`${API}/types`, {
            kind: 'type',
            name: 'TData',
            fields: [
                { key: 'b', type: { t: 'number' }, optional: false },
                { key: 'note', type: { t: 'string' }, optional: true },
            ],
        });
        expect(created.status, JSON.stringify(created.body)).toBe(201);
        expect(created.body).toMatchObject({ name: 'TData', kind: 'type', origin: 'story', file: 'types/TData.ts' });
        expect(created.body).not.toHaveProperty('catalog');
        expect(await read('types/TData.ts')).toBe('export type TData = { b: number; note?: string };\n');
        expect(await read('types/index.ts')).toContain("export * from './TData';");
    }, 60_000);

    it('creates a class holding a character id and a TData', async () => {
        const created = await t.post(`${API}/types`, {
            kind: 'class',
            name: 'Squad',
            fields: [
                { key: 'ch', type: { t: 'ref', name: 'Character' }, optional: false },
                { key: 'd', type: DATA, optional: false },
            ],
            catalog: { name: 'squads' },
        });
        expect(created.status, JSON.stringify(created.body)).toBe(201);
        expect(created.body).toMatchObject({
            kind: 'class',
            fields: [
                { key: 'ch', type: { t: 'ref', name: 'Character' } },
                { key: 'd', type: DATA },
            ],
            catalog: { name: 'squads', idType: 'TSquadId' },
        });
        const text = await read('types/Squad.ts');
        expect(text).toContain("import type { TCharacterId } from './ids';");
        expect(text).toContain("import type { TData } from './TData';");
        expect(text).toContain('export class Squad {\n    declare ch: TCharacterId;\n    declare d: TData;\n}');
        expect(refTarget('Character', await structure())).toEqual({ source: 'entities', kind: 'characters' });
    }, 60_000);

    it('creates an entry whose d has the fixed TData shape', async () => {
        const created = await t.post(ENTRIES, { id: 'red', values: { ch: 'annie', d: { b: 2 } } });
        expect(created.status, JSON.stringify(created.body)).toBe(201);
        expect(created.body.values).toEqual({ ch: 'annie', d: { b: 2 } });
        expect(await read('data/catalogs/squads.ts')).toContain("red: { ch: 'annie', d: { b: 2 } }");

        expect((await t.post(ENTRIES, { id: 'blue', values: { ch: 'annie', d: { b: 1, x: 1 } } })).status).toBe(400);
        expect((await t.post(ENTRIES, { id: 'blue', values: { ch: 'annie', d: { b: 'one' } } })).status).toBe(400);
        expect((await t.post(ENTRIES, { id: 'blue', values: { ch: 'nobody', d: { b: 1 } } })).status).toBe(422);

        const red = (await t.get(`${ENTRIES}/red`)).body;
        const updated = await t.put(`${ENTRIES}/red`, {
            version: red.version,
            values: { ch: 'thomas', d: { b: 3, note: 'n' } },
        });
        expect(updated.status, JSON.stringify(updated.body)).toBe(200);
        expect(updated.body.values).toEqual({ ch: 'thomas', d: { b: 3, note: 'n' } });
        await expectTsc();
    }, 60_000);

    it('migrates every TData value: catalog entries, entity init and chapter data, through arrays and objects', async () => {
        const stats = await updateType('TCharacterData', (fields) => [
            ...fields,
            { key: 'stats', type: { t: 'array', of: DATA }, optional: true },
        ]);
        expect(stats.status, JSON.stringify(stats.body)).toBe(200);
        await handEdit('data/characters/annie.ts', 'health: 100,', 'health: 100, stats: [{ b: 1 }, { b: 2 }],');
        await handEdit(
            VILLAGE,
            "import { TChapter } from '@story/types';",
            "import { TChapter, TData } from '@story/types';"
        );
        await handEdit(
            VILLAGE,
            "asd: 'asd',\n        },",
            "asd: 'asd',\n        },\n        nested: { inner: { b: 5 } },"
        );
        await handEdit(
            VILLAGE,
            '        asd: string;\n    };',
            '        asd: string;\n    };\n    nested: { inner: TData };'
        );
        await expectTsc();

        const updated = await updateType(
            'TData',
            (fields) => [
                ...fields.map((f: TAny) => (f.key === 'b' ? { ...f, key: 'bb' } : f)),
                { key: 'c', type: { t: 'number' }, optional: false },
            ],
            { renames: { b: 'bb' } }
        );
        expect(updated.status, JSON.stringify(updated.body)).toBe(200);
        expect(updated.body.touchedFiles).toEqual(['data/catalogs/squads.ts', VILLAGE, 'data/characters/annie.ts']);
        expect(await read('data/catalogs/squads.ts')).toMatch(/d: \{ bb: 3, note: 'n', c: 0 \}/);
        expect(await read('data/characters/annie.ts')).toContain(
            'stats: [\n            { bb: 1, c: 0 },\n            { bb: 2, c: 0 },\n        ]'
        );
        expect(await read(VILLAGE)).toMatch(/inner: \{ bb: 5, c: 0 \}/);
        expect(await read('types/TData.ts')).toContain('bb: number');
        await expectTsc();
    }, 60_000);

    it('refuses a recursive type, directly or through another type', async () => {
        const self = await updateType('TData', (fields) => [...fields, { key: 'self', type: DATA, optional: true }]);
        expect(self.status).toBe(422);
        expect(self.body.diagnostics).toEqual([
            expect.objectContaining({ field: 'fields.3.type', message: expect.stringContaining('TData.self') }),
        ]);

        const other = await t.post(`${API}/types`, {
            kind: 'type',
            name: 'TOther',
            fields: [
                {
                    key: 'data',
                    type: { t: 'object', fields: [{ key: 'd', type: DATA, optional: false }] },
                    optional: false,
                },
            ],
        });
        expect(other.status, JSON.stringify(other.body)).toBe(201);
        const before = await read('types/TData.ts');
        const through = await updateType('TData', (fields) => [
            ...fields,
            { key: 'others', type: { t: 'array', of: { t: 'struct', name: 'TOther' } }, optional: true },
        ]);
        expect(through.status).toBe(422);
        expect(through.body.diagnostics[0].message).toContain('TOther');
        expect(await read('types/TData.ts')).toBe(before);

        const unknown = await updateType('TData', (fields) => [
            ...fields,
            { key: 'x', type: { t: 'struct', name: 'Squad' }, optional: true },
        ]);
        expect(unknown.status).toBe(400);
    }, 60_000);

    it('refuses a TData field holding the ids of a class that holds a TData', async () => {
        const refused = await updateType('TData', (fields) => [
            ...fields,
            { key: 'squad', type: { t: 'ref', name: 'Squad' }, optional: true },
        ]);
        expect(refused.status).toBe(422);
        expect(refused.body.diagnostics[0].message).toContain('TSquadId');
    }, 60_000);

    it('clears a deleted id held inside a TData value', async () => {
        const race = await t.post(`${API}/types`, {
            kind: 'class',
            name: 'Race',
            fields: [],
            catalog: { name: 'races' },
        });
        expect(race.status, JSON.stringify(race.body)).toBe(201);
        expect((await t.post(`${STORY}/catalogs/races`, { id: 'elf', values: {} })).status).toBe(201);
        const withRace = await updateType('TData', (fields) => [
            ...fields,
            { key: 'race', type: { t: 'ref', name: 'Race' }, optional: true },
        ]);
        expect(withRace.status, JSON.stringify(withRace.body)).toBe(200);
        await handEdit('data/catalogs/squads.ts', "note: 'n',", "note: 'n', race: 'elf',");

        const elf = (await t.get(`${STORY}/catalogs/races/elf`)).body;
        const deleted = await t.del(`${STORY}/catalogs/races/elf`, { version: elf.version });
        expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
        expect(deleted.body.cleared).toEqual([
            expect.objectContaining({ file: 'data/catalogs/squads.ts', path: 'd.race', change: { op: 'removed' } }),
        ]);
        expect(await read('data/catalogs/squads.ts')).not.toContain('elf');
    }, 60_000);

    it('reorders and adds class members as `declare` fields', async () => {
        const updated = await updateType('Squad', (fields) => [
            ...[...fields].reverse(),
            { key: 'motto', type: { t: 'string' }, optional: true, description: 'Shouted.' },
        ]);
        expect(updated.status, JSON.stringify(updated.body)).toBe(200);
        expect(await read('types/Squad.ts')).toContain(
            'export class Squad {\n    declare d: TData;\n    declare ch: TCharacterId;\n    /** Shouted. */\n    declare motto?: string;\n}'
        );
        await expectTsc();
    }, 60_000);

    it('refuses to delete a used type, deletes an unused one', async () => {
        const data = await typeNamed('TData');
        const used = await t.del(`${API}/types/TData`, { version: data.version });
        expect(used.status).toBe(409);
        expect(used.body.references.map((r: TAny) => r.file)).toEqual(expect.arrayContaining(['types/Squad.ts']));

        const other = await typeNamed('TOther');
        expect((await t.del(`${API}/types/TOther`, { version: other.version })).status).toBe(200);
        expect(await exists('types/TOther.ts')).toBe(false);
        expect(await read('types/index.ts')).not.toContain('TOther');
        await expectTsc();
    }, 60_000);
});
