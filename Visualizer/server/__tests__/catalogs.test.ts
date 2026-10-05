import { readFile, writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TAny } from './helpers';
import { startSourceApp, tscTemp } from './sourceHelpers';

let t: Awaited<ReturnType<typeof startSourceApp>>;

const STORY = '/api/stories/example';
const RACES = `${STORY}/catalogs/races`;

const read = (file: string) => readFile(t.project.abs(file), 'utf8');

const handEdit = async (file: string, from: string | RegExp, to: string) => {
    const text = await read(file);
    const next = text.replace(from, to);
    expect(next, `${file} has ${String(from)}`).not.toBe(text);
    await writeFile(t.project.abs(file), next);
};

const entry = async (id: string) => (await t.get(`${RACES}/${id}`)).body;

const createRace = (id: string, values: Record<string, unknown>) => t.post(RACES, { id, values });

const deleteRace = async (id: string) => t.del(`${RACES}/${id}`, { version: (await entry(id)).version });

const addField = async (typeName: string, field: Record<string, unknown>) => {
    const type = (await t.get(`${STORY}/structure`)).body.types.find((x: TAny) => x.name === typeName);
    const res = await t.put(`${STORY}/structure/types/${typeName}`, {
        version: type.version,
        fields: [...type.fields, field],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
};

const expectTsc = async () => {
    const tsc = await tscTemp(t.project.root);
    expect(tsc.output).toBe('');
};

beforeAll(async () => {
    t = await startSourceApp();
    const created = await t.post(`${STORY}/structure/types`, {
        name: 'TRace',
        fields: [
            { key: 'name', type: { t: 'string' }, optional: false },
            { key: 'strength', type: { t: 'number' }, optional: true },
            { key: 'home', type: { t: 'ref', name: 'TLocation' }, optional: true },
        ],
        catalog: { name: 'races' },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
}, 60_000);
afterAll(async () => {
    await t.close();
});

describe('catalog entries', () => {
    it('creates, reads, lists, updates and deletes entries, one event each', async () => {
        t.events.length = 0;
        let res = await createRace('elf', { name: 'Elf', strength: 2 });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        expect(res.body).toMatchObject({
            kind: 'catalog',
            catalog: 'races',
            type: 'TRace',
            id: 'elf',
            file: 'data/catalogs/races.ts',
            exportName: 'races',
            values: { name: 'Elf', strength: 2 },
        });
        expect(t.events).toEqual([{ kind: 'catalog', id: 'races/elf', version: res.body.version, op: 'created' }]);
        expect(await read('data/catalogs/races.ts')).toContain("elf: { name: 'Elf', strength: 2 }");

        expect((await createRace('elf', { name: 'Elf' })).status).toBe(409);
        expect((await createRace('orc', { name: 'Orc', wings: 2 })).status).toBe(400);
        const missing = await createRace('orc', { strength: 9 });
        expect(missing.status).toBe(422);
        expect((await createRace('dwarf', { name: 'Dwarf' })).status).toBe(201);

        const list = await t.get(RACES);
        expect(list.status).toBe(200);
        expect(list.body.catalog).toBe('races');
        expect(list.body.entries.map((e: TAny) => e.id)).toEqual(['elf', 'dwarf']);
        expect((await t.get(`${STORY}/catalogs/dragons`)).status).toBe(404);
        expect((await t.get(`${RACES}/orc`)).status).toBe(404);

        const elf = await entry('elf');
        t.events.length = 0;
        res = await t.put(`${RACES}/elf`, { version: elf.version, values: { name: 'High elf' } });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.values).toEqual({ name: 'High elf' });
        expect(t.events).toEqual([{ kind: 'catalog', id: 'races/elf', version: res.body.version, op: 'updated' }]);
        const stale = await t.put(`${RACES}/elf`, { version: elf.version, values: { name: 'Elf' } });
        expect(stale.status).toBe(409);
        expect(stale.body.error).toBe('stale');
        const bad = await t.put(`${RACES}/elf`, { version: res.body.version, values: { name: 3 } });
        expect(bad.status).toBe(400);

        t.events.length = 0;
        res = await deleteRace('dwarf');
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body).toEqual({ ok: true, cleared: [] });
        expect(t.events).toEqual([{ kind: 'catalog', id: 'races/dwarf', version: null, op: 'deleted' }]);
        expect(await read('data/catalogs/races.ts')).not.toContain('dwarf');
        await expectTsc();
    }, 60_000);
});

describe('deleting a referenced instance', () => {
    it('clears optional and array references, defaults required ones, and emits an event per holder', async () => {
        expect((await createRace('dwarf', { name: 'Dwarf' })).status).toBe(201);
        await addField('TCharacter', { key: 'race', type: { t: 'ref', name: 'TRace' }, optional: false });
        await addField('TCharacterData', { key: 'rival', type: { t: 'ref', name: 'TRace' }, optional: true });
        await addField('TCharacterData', {
            key: 'allies',
            type: { t: 'array', of: { t: 'ref', name: 'TRace' } },
            optional: true,
        });
        await handEdit('data/characters/annie.ts', "race: 'elf'", "race: 'dwarf'");
        await handEdit('data/characters/annie.ts', 'health: 100,', "health: 100, allies: ['dwarf', 'elf'],");
        await handEdit('data/characters/thomas.ts', 'health: 100,', "health: 100, rival: 'dwarf',");

        const preview = await t.get(`${RACES}/dwarf/references`);
        expect(preview.status, JSON.stringify(preview.body)).toBe(200);
        expect(preview.body.blocking).toEqual([]);
        const expected = [
            expect.objectContaining({
                file: 'data/characters/annie.ts',
                resource: { kind: 'entity', id: 'characters/annie' },
                path: 'race',
                change: { op: 'set', value: 'elf' },
            }),
            expect.objectContaining({
                file: 'data/characters/thomas.ts',
                resource: { kind: 'entity', id: 'characters/thomas' },
                path: 'init.rival',
                change: { op: 'removed' },
            }),
            expect.objectContaining({
                file: 'data/characters/annie.ts',
                resource: { kind: 'entity', id: 'characters/annie' },
                path: 'init.allies.0',
                change: { op: 'removed' },
            }),
        ];
        expect(preview.body.cleared).toEqual(expect.arrayContaining(expected));
        expect(preview.body.cleared).toHaveLength(3);
        expect(await read('data/catalogs/races.ts')).toContain('dwarf');

        t.events.length = 0;
        const res = await deleteRace('dwarf');
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.cleared).toEqual(expect.arrayContaining(expected));
        expect(await read('data/characters/annie.ts')).toContain("race: 'elf'");
        expect(await read('data/characters/thomas.ts')).not.toContain('rival');
        expect(await read('data/characters/annie.ts')).toContain("allies: ['elf']");
        expect(t.events.map((e) => `${e.kind}:${e.id}:${e.op}`).sort()).toEqual([
            'catalog:races/dwarf:deleted',
            'entity:characters/annie:updated',
            'entity:characters/thomas:updated',
        ]);
        const annie = (await t.get(`${STORY}/entities/characters/annie`)).body;
        expect(t.events.find((e) => e.id === 'characters/annie')?.version).toBe(annie.version);
        await expectTsc();
    }, 60_000);

    it('refuses while a required value has no other id, or code names the id', async () => {
        const preview = await t.get(`${RACES}/elf/references`);
        expect(preview.body.blocking.map((r: TAny) => r.file).sort()).toEqual([
            'data/characters/annie.ts',
            'data/characters/thomas.ts',
        ]);
        const before = await read('data/catalogs/races.ts');
        const refused = await deleteRace('elf');
        expect(refused.status).toBe(409);
        expect(refused.body.error).toBe('referenced');
        expect(refused.body.references.map((r: TAny) => r.file).sort()).toEqual([
            'data/characters/annie.ts',
            'data/characters/thomas.ts',
        ]);
        expect(await read('data/catalogs/races.ts')).toBe(before);

        expect((await createRace('orc', { name: 'Orc' })).status).toBe(201);
        await writeFile(
            t.project.abs('data/favourites.ts'),
            "import type { TRaceId } from '@story/types';\n\nexport const favouriteRace: TRaceId = 'orc';\n"
        );
        const codePreview = await t.get(`${RACES}/orc/references`);
        expect(codePreview.body.cleared).toEqual([]);
        expect(codePreview.body.blocking).toEqual([expect.objectContaining({ file: 'data/favourites.ts', line: 3 })]);
        const code = await deleteRace('orc');
        expect(code.status).toBe(409);
        expect(code.body.references).toEqual([expect.objectContaining({ file: 'data/favourites.ts' })]);
        expect((await entry('orc')).id).toBe('orc');
    }, 60_000);

    it('clears a deleted location from characters, npcs, sublocations and chapters', async () => {
        const created = await t.post(`${STORY}/entities/locations`, { id: 'forest', name: 'Forest' });
        expect(created.status, JSON.stringify(created.body)).toBe(201);
        const kingdom = (await t.get(`${STORY}/entities/locations/kingdom`)).body;
        const res0 = await t.put(`${STORY}/entities/locations/kingdom`, {
            version: kingdom.version,
            sublocations: ['forest'],
        });
        expect(res0.status, JSON.stringify(res0.body)).toBe(200);
        await handEdit('data/characters/thomas.ts', "location: 'village'", "location: 'forest'");
        await handEdit('data/npcs/Franta.ts', "location: 'village'", "location: 'forest'");
        await handEdit('data/chapters/wedding/wedding.chapter.ts', "location: 'kingdom'", "location: 'forest'");
        await handEdit('data/catalogs/races.ts', "name: 'Orc'", "name: 'Orc', home: 'forest'");

        t.events.length = 0;
        const forest = (await t.get(`${STORY}/entities/locations/forest`)).body;
        const res = await t.del(`${STORY}/entities/locations/forest`, { version: forest.version });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.cleared.map((r: TAny) => [r.resource.id, r.path, r.change])).toEqual(
            expect.arrayContaining([
                ['characters/thomas', 'init.location', { op: 'removed' }],
                ['npcs/franta', 'init.location', { op: 'set', value: null }],
                ['locations/kingdom', 'sublocations.0', { op: 'removed' }],
                ['wedding', 'location', { op: 'set', value: 'village' }],
                ['races/orc', 'home', { op: 'removed' }],
            ])
        );
        expect(res.body.cleared).toHaveLength(5);
        expect(await read('data/catalogs/races.ts')).not.toContain('forest');
        expect(await read('data/characters/thomas.ts')).not.toContain('location');
        expect(await read('data/npcs/Franta.ts')).toContain('location: undefined');
        expect(await read('data/locations/kingdom.location.ts')).not.toMatch(/forest/i);
        expect(await read('data/chapters/wedding/wedding.chapter.ts')).toContain("location: 'village'");
        expect(t.events).toContainEqual(
            expect.objectContaining({ kind: 'chapter', id: 'wedding', chapterId: 'wedding', op: 'updated' })
        );
        await expectTsc();
    }, 60_000);
});
