import { access, readFile, writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TAny } from './helpers/http';
import { startSourceApp, tscTemp } from './helpers/sourceHelpers';

let t: Awaited<ReturnType<typeof startSourceApp>>;

const API = '/api/stories/example/structure';

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

const structure = async () => (await t.get(API)).body;

const typeNamed = async (name: string) => (await structure()).types.find((type: TAny) => type.name === name);

const literalNamed = async (name: string) =>
    (await structure()).literals.find((literal: TAny) => literal.name === name);

const updateType = async (name: string, change: (fields: TAny[]) => TAny[], extra: Record<string, unknown> = {}) => {
    const type = await typeNamed(name);
    return t.put(`${API}/types/${name}`, { version: type.version, fields: change(type.fields), ...extra });
};

const memberLines = (text: string, keys: string[]) =>
    text.split('\n').filter((line) => keys.some((key) => new RegExp(`^\\s+(declare )?${key}\\??:`).test(line)));

describe('structure writers', () => {
    describe('types', () => {
        it('validates the name', async () => {
            const post = (body: Record<string, unknown>) => t.post(`${API}/types`, { fields: [], ...body });
            const bad = await post({ kind: 'type', name: 'race' });
            expect(bad.status).toBe(422);
            expect(bad.body.diagnostics[0].field).toBe('name');
            expect((await post({ name: 'TData' })).status).toBe(400);
            expect((await post({ kind: 'type', name: 'TRaceId' })).status).toBe(422);
            expect((await post({ kind: 'type', name: 'TCharacterData' })).status).toBe(409);
            expect((await post({ kind: 'type', name: 'TItemType' })).status).toBe(409);
            expect((await post({ kind: 'type', name: 'TWorldState' })).status).toBe(409);
            expect((await post({ kind: 'type', name: 'TData', catalog: { name: 'datas' } })).status).toBe(400);

            const catalog = { name: 'things' };
            expect((await post({ kind: 'class', name: 'TRace', catalog })).status).toBe(422);
            expect((await post({ kind: 'class', name: 'race', catalog })).status).toBe(422);
            const reserved = await post({ kind: 'class', name: 'Item', catalog });
            expect(reserved.status).toBe(422);
            expect(reserved.body.diagnostics[0].message).toContain('reserved');
            expect((await post({ kind: 'class', name: 'Character', catalog })).status).toBe(409);
            expect((await post({ kind: 'class', name: 'Race' })).status).toBe(400);
        }, 60_000);

        it('creates a class with its catalog, barrel line and id type, importing types only', async () => {
            t.events.length = 0;
            const created = await t.post(`${API}/types`, {
                kind: 'class',
                name: 'Race',
                fields: [
                    { key: 'name', type: { t: 'string' }, optional: false },
                    { key: 'strength', type: { t: 'number' }, optional: false, description: 'How strong.' },
                    { key: 'home', type: { t: 'ref', name: 'Location' }, optional: true },
                ],
                catalog: { name: 'races' },
            });
            expect(created.status, JSON.stringify(created.body)).toBe(201);
            expect(created.body).toMatchObject({
                name: 'Race',
                kind: 'class',
                origin: 'story',
                file: 'types/Race.ts',
                catalog: { name: 'races', file: 'data/catalogs/races.ts', idType: 'TRaceId' },
            });
            expect(created.body.fields.map((f: TAny) => f.key)).toEqual(['name', 'strength', 'home']);

            const typeText = await read('types/Race.ts');
            expect(typeText).toContain("import type { races } from '@story/data/catalogs/races';");
            expect(typeText).toContain("import type { TLocationId } from './Location';");
            expect(typeText).toContain(
                'export class Race {\n    declare name: string;\n    /** How strong. */\n    declare strength: number;\n    declare home?: TLocationId;\n}'
            );
            expect(typeText).toContain('export type TRaceId = keyof typeof races;');
            expect(typeText).not.toMatch(/^import \{/m);
            expect(await read('data/catalogs/races.ts')).toBe(
                "import type { Race } from '@story/types';\n\nexport const races = {} satisfies Record<string, Race>;\n"
            );
            expect(await read('types/index.ts')).toContain("export * from './Race';");
            expect(t.events).toEqual([expect.objectContaining({ kind: 'structure', id: 'structure', op: 'created' })]);
        }, 60_000);

        it('refuses a class whose fields reference its own ids', async () => {
            const refused = await t.post(`${API}/types`, {
                kind: 'class',
                name: 'Tribe',
                fields: [
                    { key: 'name', type: { t: 'string' }, optional: false },
                    { key: 'kin', type: { t: 'array', of: { t: 'ref', name: 'Tribe' } }, optional: true },
                ],
                catalog: { name: 'tribes' },
            });
            expect(refused.status).toBe(422);
            expect(refused.body.diagnostics).toEqual([
                expect.objectContaining({ field: 'fields.1.type', message: expect.stringContaining('TTribeId') }),
            ]);
            expect(await exists('types/Tribe.ts')).toBe(false);
        }, 60_000);

        it('fills a default for a new required field on every instance, keeping engine fields verbatim', async () => {
            const before = await read('types/Character.ts');
            const locked = [
                'location',
                'health',
                'inventory',
                'id',
                'name',
                'description',
                'image',
                'startPassageId',
                'init',
            ];
            const updated = await updateType('TCharacterData', (fields) => [
                ...fields,
                { key: 'energy', type: { t: 'number' }, optional: false },
            ]);
            expect(updated.status).toBe(200);
            expect(updated.body.touchedFiles).toEqual(['data/characters/annie.ts', 'data/characters/thomas.ts']);
            expect(updated.body.type.fields.at(-1)).toEqual({ key: 'energy', type: { t: 'number' }, optional: false });
            const after = await read('types/Character.ts');
            expect(memberLines(after, locked)).toEqual(memberLines(before, locked));
            expect(after).toContain('    energy: number;\n');
            for (const file of updated.body.touchedFiles) expect(await read(file)).toMatch(/energy: 0,/);
        }, 60_000);

        it('adds a ref field to an extendable type with an `import type`, defaulting to the first id', async () => {
            const catalog = await read('data/catalogs/races.ts');
            await writeFile(
                t.project.abs('data/catalogs/races.ts'),
                catalog.replace('{}', "{ elf: { name: 'Elf', strength: 2 }, dwarf: { name: 'Dwarf', strength: 5 } }")
            );
            const updated = await updateType('Character', (fields) => [
                ...fields,
                { key: 'race', type: { t: 'ref', name: 'Race' }, optional: false },
            ]);
            expect(updated.status).toBe(200);
            expect(await read('types/Character.ts')).toContain("import type { TRaceId } from './Race';");
            expect(await read('data/characters/annie.ts')).toContain("race: 'elf'");
        }, 60_000);

        it('renames and removes fields on the catalog entries', async () => {
            const updated = await updateType(
                'Race',
                (fields) =>
                    fields
                        .filter((f: TAny) => f.key !== 'home')
                        .map((f: TAny) => (f.key === 'strength' ? { ...f, key: 'power' } : f)),
                { renames: { strength: 'power' } }
            );
            expect(updated.status).toBe(200);
            expect(updated.body.touchedFiles).toEqual(['data/catalogs/races.ts']);
            const catalog = await read('data/catalogs/races.ts');
            expect(catalog).toContain('power: 2');
            expect(catalog).not.toContain('strength');
            const typeText = await read('types/Race.ts');
            expect(typeText).toContain('/** How strong. */\n    declare power: number;');
            expect(typeText).not.toContain('TLocationId');
        }, 60_000);

        it('refuses an incompatible type change, then resets the values on request', async () => {
            const retype = (fields: TAny[]) =>
                fields.map((f: TAny) => (f.key === 'power' ? { ...f, type: { t: 'string' } } : f));
            const refused = await updateType('Race', retype);
            expect(refused.status).toBe(422);
            expect(refused.body.diagnostics[0].file).toBe('data/catalogs/races.ts');
            const reset = await updateType('Race', retype, { resetIncompatible: true });
            expect(reset.status).toBe(200);
            expect(await read('data/catalogs/races.ts')).toContain("power: ''");
        }, 60_000);

        it('refuses a field that reaches its own catalog ids through another catalog or the items', async () => {
            const clan = await t.post(`${API}/types`, {
                kind: 'class',
                name: 'Clan',
                fields: [{ key: 'race', type: { t: 'ref', name: 'Race' }, optional: false }],
                catalog: { name: 'clans' },
            });
            expect(clan.status, JSON.stringify(clan.body)).toBe(201);
            const itemRace = await updateType('TItemInfo', (fields) => [
                ...fields,
                { key: 'race', type: { t: 'ref', name: 'Race' }, optional: true },
            ]);
            expect(itemRace.status, JSON.stringify(itemRace.body)).toBe(200);

            const cyclic: TAny[] = [
                { key: 'clans', type: { t: 'array', of: { t: 'ref', name: 'Clan' } }, optional: true },
                {
                    key: 'family',
                    type: { t: 'object', fields: [{ key: 'clan', type: { t: 'ref', name: 'Clan' }, optional: true }] },
                    optional: true,
                },
                { key: 'rank', type: { t: 'code', code: 'Partial<Record<TClanId, number>>' }, optional: true },
                { key: 'relic', type: { t: 'ref', name: 'TItem' }, optional: true },
            ];
            const before = await read('types/Race.ts');
            for (const field of cyclic) {
                const refused = await updateType('Race', (fields) => [...fields, field]);
                expect(refused.status, field.key).toBe(422);
                expect(refused.body.diagnostics).toEqual([
                    expect.objectContaining({ field: expect.stringMatching(/^fields\.\d+\.type$/) }),
                ]);
                expect(refused.body.diagnostics[0].message).toContain('TRaceId');
            }
            expect(await read('types/Race.ts')).toBe(before);
        }, 60_000);

        it('keeps the catalog ids exact for tsc: no circularity, and an unknown id is an error', async () => {
            const clans = await read('data/catalogs/clans.ts');
            await writeFile(t.project.abs('data/catalogs/clans.ts'), clans.replace('{}', "{ north: { race: 'elf' } }"));
            const clean = await tscTemp(t.project.root);
            expect(clean.output).toBe('');

            await writeFile(t.project.abs('data/catalogs/clans.ts'), clans.replace('{}', "{ north: { race: 'orc' } }"));
            const broken = await tscTemp(t.project.root);
            expect(broken.output).toMatch(/data\/catalogs\/clans\.ts.*TS2322/);
            expect(broken.output).not.toMatch(/TS7022|TS2502|TS2456/);
            await writeFile(t.project.abs('data/catalogs/clans.ts'), clans.replace('{}', "{ north: { race: 'elf' } }"));
        }, 60_000);

        it('refuses to change an engine field, and to delete a used, extendable or engine type', async () => {
            const locked = await updateType('TCharacterData', (fields) =>
                fields.map((f: TAny) => (f.key === 'health' ? { ...f, type: { t: 'string' } } : f))
            );
            expect(locked.status).toBe(400);

            const race = await typeNamed('Race');
            const used = await t.del(`${API}/types/Race`, { version: race.version });
            expect(used.status).toBe(409);
            expect(used.body.error).toBe('referenced');
            expect(used.body.references.map((r: TAny) => r.file)).toEqual(
                expect.arrayContaining(['types/Character.ts', 'data/catalogs/races.ts'])
            );

            const character = await typeNamed('Character');
            expect((await t.del(`${API}/types/Character`, { version: character.version })).status).toBe(403);
            expect((await t.del(`${API}/types/TChapter`, { version: 'unknown' })).status).toBe(403);
            expect((await t.del(`${API}/types/Race`, { version: 'old' })).status).toBe(409);
        }, 60_000);

        it('deletes an unused class with its empty catalog and barrel line', async () => {
            const created = await t.post(`${API}/types`, {
                kind: 'class',
                name: 'Pet',
                fields: [{ key: 'name', type: { t: 'string' }, optional: false }],
                catalog: { name: 'pets' },
            });
            expect(created.status).toBe(201);
            const deleted = await t.del(`${API}/types/Pet`, { version: created.body.version });
            expect(deleted.status).toBe(200);
            expect(await exists('types/Pet.ts')).toBe(false);
            expect(await exists('data/catalogs/pets.ts')).toBe(false);
            expect(await read('types/index.ts')).not.toContain('Pet');
            expect(await typeNamed('Pet')).toBeUndefined();
        }, 60_000);
    });

    describe('literals', () => {
        it('creates a global literal and appends a value from the input', async () => {
            const created = await t.post(`${API}/literals`, { name: 'TMood', values: ['happy', 'sad'] });
            expect(created.status).toBe(201);
            expect(created.body).toMatchObject({
                scope: 'global',
                file: 'types/literals.ts',
                values: ['happy', 'sad'],
            });
            expect(await read('types/literals.ts')).toBe("export type TMood = 'happy' | 'sad';\n");

            t.events.length = 0;
            const added = await t.post(`${API}/literals/TMood/values`, { value: 'calm' });
            expect(added.status).toBe(200);
            expect(added.body.values).toEqual(['happy', 'sad', 'calm']);
            expect(t.events).toEqual([expect.objectContaining({ kind: 'structure', op: 'updated' })]);
            expect((await t.post(`${API}/literals/TMood/values`, { value: 'calm' })).status).toBe(409);
        }, 60_000);

        it('creates a local literal after the imports of its file', async () => {
            const created = await t.post(`${API}/literals`, {
                name: 'TTone',
                values: ['dark'],
                file: 'data/items/foodInfo.ts',
            });
            expect(created.status).toBe(201);
            expect(created.body.scope).toBe('local');
            const text = await read('data/items/foodInfo.ts');
            expect(text.indexOf("export type TTone = 'dark';")).toBeGreaterThan(text.lastIndexOf('import '));
            expect((await t.post(`${API}/literals`, { name: 'TTone', values: ['x'] })).status).toBe(409);
        }, 60_000);

        it('renames a used value where the literal types it, and refuses to remove one', async () => {
            const literal = await literalNamed('TItemType');
            const renamed = await t.put(`${API}/literals/TItemType`, {
                version: literal.version,
                values: literal.values.map((v: string) => (v === 'weapon' ? 'arms' : v)),
                renames: { weapon: 'arms' },
            });
            expect(renamed.status).toBe(200);
            expect(renamed.body.values).toContain('arms');
            const items = await read('data/items/itemInfo.ts');
            expect(items).toContain("type: 'arms'");
            expect(items).not.toContain("'weapon'");

            const removed = await t.put(`${API}/literals/TItemType`, {
                version: renamed.body.version,
                values: renamed.body.values.filter((v: string) => v !== 'tool'),
            });
            expect(removed.status).toBe(409);
            expect(removed.body.references).toEqual([expect.objectContaining({ file: 'data/items/toolInfo.ts' })]);

            const unused = await t.put(`${API}/literals/TItemType`, {
                version: renamed.body.version,
                values: [...renamed.body.values, 'gem'],
            });
            expect(unused.status).toBe(200);
            const dropped = await t.put(`${API}/literals/TItemType`, {
                version: unused.body.version,
                values: unused.body.values.filter((v: string) => v !== 'gem'),
            });
            expect(dropped.status).toBe(200);
            expect(dropped.body.values).not.toContain('gem');
        }, 60_000);

        it('refuses to delete a used literal and deletes an unused one', async () => {
            const itemType = await literalNamed('TItemType');
            const used = await t.del(`${API}/literals/TItemType`, { version: itemType.version });
            expect(used.status).toBe(409);
            expect(used.body.references[0].file).toBe('data/items/itemInfo.ts');

            const tone = await literalNamed('TTone');
            expect((await t.del(`${API}/literals/TTone`, { version: tone.version })).status).toBe(200);
            expect(await read('data/items/foodInfo.ts')).not.toContain('TTone');
        }, 60_000);
    });

    describe('entities on the structure', () => {
        it('writes a data type from fields, importing the literals and ids it names', async () => {
            const literal = await t.post(`${API}/literals`, { name: 'TTemper', values: ['calm', 'wild'] });
            expect(literal.status, JSON.stringify(literal.body)).toBe(201);
            const traits = await t.post(`${API}/types`, {
                kind: 'type',
                name: 'TTraits',
                fields: [{ key: 'brave', type: { t: 'boolean' }, optional: false }],
            });
            expect(traits.status, JSON.stringify(traits.body)).toBe(201);
            const annie = (await t.get('/api/stories/example/entities/characters/annie')).body;
            const fields = [
                ...annie.dataType.fields,
                { key: 'temper', type: { t: 'literal', name: 'TTemper' }, optional: false },
                { key: 'rivals', type: { t: 'array', of: { t: 'ref', name: 'Race' } }, optional: true },
                { key: 'friend', type: { t: 'ref', name: 'Character' }, optional: true },
                { key: 'traits', type: { t: 'struct', name: 'TTraits' }, optional: true },
            ];
            const saved = await t.put('/api/stories/example/entities/characters/annie', {
                version: annie.version,
                dataType: { name: annie.dataType.name, code: 'ignored when fields are given', fields },
            });
            expect(saved.status, JSON.stringify(saved.body)).toBe(200);
            expect(saved.body.dataType.fields).toEqual(fields);
            const text = await read('data/characters/annie.ts');
            expect(text).toMatch(/import type \{[^}]*\bTTemper\b[^}]*\} from '@story\/types';/);
            expect(text).toMatch(/import type \{[^}]*\bTRaceId\b[^}]*\} from '@story\/types';/);
            expect(text).toMatch(/import type \{[^}]*\bTTraits\b[^}]*\} from '@story\/types';/);
            expect(text).toMatch(/import type \{[^}]*\bTCharacterId\b[^}]*\} from '@story\/types';/);
            expect(text).toMatch(
                /temper: TTemper;\s+rivals\?: TRaceId\[\];\s+friend\?: TCharacterId;\s+traits\?: TTraits;?\s+\}/
            );

            const unknown = await t.put('/api/stories/example/entities/characters/annie', {
                version: saved.body.version,
                dataType: {
                    name: annie.dataType.name,
                    fields: [{ key: 'x', type: { t: 'literal', name: 'TNoSuch' }, optional: false }],
                },
            });
            expect(unknown.status).toBe(400);
        }, 60_000);

        it('creates an item with defaults for the required TItemInfo fields', async () => {
            const updated = await updateType('TItemInfo', (fields) => [
                ...fields,
                { key: 'weight', type: { t: 'number' }, optional: false },
            ]);
            expect(updated.status, JSON.stringify(updated.body)).toBe(200);
            const created = await t.post('/api/stories/example/entities/items', {
                id: 'gem',
                name: 'Gem',
                type: 'value',
                props: { shiny: true },
            });
            expect(created.status, JSON.stringify(created.body)).toBe(201);
            expect(created.body.props).toEqual({ weight: 0, shiny: true });
            const kept = await t.post('/api/stories/example/entities/items', {
                id: 'rock',
                type: 'value',
                props: { weight: 7 },
            });
            expect(kept.status).toBe(201);
            expect(kept.body.props).toEqual({ weight: 7 });
        }, 60_000);
    });
});
