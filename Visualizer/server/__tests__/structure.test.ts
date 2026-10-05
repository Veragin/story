import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TAny } from './helpers';
import { startSourceApp } from './sourceHelpers';

let t: Awaited<ReturnType<typeof startSourceApp>>;

beforeAll(async () => {
    t = await startSourceApp();
});
afterAll(async () => {
    await t.close();
});

const structure = async () => {
    const { status, body } = await t.get('/api/stories/example/structure');
    expect(status).toBe(200);
    return body;
};

const typeNamed = (body: TAny, name: string) => body.types.find((type: TAny) => type.name === name);

const write = async (file: string, text: string) => {
    const abs = t.project.abs(file);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, text);
};

const edit = async (file: string, from: string, to: string) => {
    const text = await readFile(t.project.abs(file), 'utf8');
    expect(text).toContain(from);
    await writeFile(t.project.abs(file), text.replace(from, to));
};

describe('structure reader', () => {
    it('reads the example: one local literal, the extendable types with locked fields, no engine types', async () => {
        const body = await structure();
        expect(body.version).toMatch(/^[0-9a-f]{16}$/);
        expect(body.diagnostics).toEqual([]);
        expect(body.literals).toEqual([
            {
                version: expect.any(String),
                file: 'data/items/itemInfo.ts',
                line: 25,
                exportName: 'TItemType',
                name: 'TItemType',
                scope: 'local',
                values: ['value', 'resource', 'tool', 'food', 'weapon'],
            },
        ]);

        const origins = Object.fromEntries(body.types.map((type: TAny) => [type.name, type.origin]));
        expect(origins).toMatchObject({
            TCharacter: 'extendable',
            TCharacterData: 'extendable',
            TNpc: 'extendable',
            TNpcData: 'extendable',
            TLocation: 'extendable',
            TItemInfo: 'extendable',
        });
        expect(Object.values(origins)).not.toContain('story');
        expect(Object.values(origins)).not.toContain('engine');

        expect(typeNamed(body, 'TCharacterData')).toMatchObject({
            file: 'types/TCharacter.ts',
            fields: [
                { key: 'location', type: { t: 'ref', name: 'TLocation' }, optional: true, locked: true },
                { key: 'health', type: { t: 'number' }, optional: false, locked: true },
                {
                    key: 'inventory',
                    type: {
                        t: 'array',
                        of: {
                            t: 'object',
                            fields: [
                                { key: 'id', type: { t: 'ref', name: 'TItem' }, optional: false },
                                { key: 'amount', type: { t: 'number' }, optional: true },
                            ],
                        },
                    },
                    optional: false,
                    locked: true,
                },
            ],
        });
        expect(typeNamed(body, 'TNpcData').fields[0]).toEqual({
            key: 'location',
            type: { t: 'ref', name: 'TLocation' },
            optional: false,
            locked: true,
        });
        expect(typeNamed(body, 'TLocation').fields).toContainEqual({
            key: 'sublocations',
            type: { t: 'array', of: { t: 'ref', name: 'TLocation' } },
            optional: true,
            locked: true,
        });
        expect(typeNamed(body, 'TNpc').file).toBe('types/TNpc.ts');
        expect(typeNamed(body, 'TItemInfo')).toMatchObject({
            file: 'data/items/itemInfo.ts',
            fields: [
                { key: 'name', type: { t: 'string' }, optional: false, locked: true },
                { key: 'type', type: { t: 'literal', name: 'TItemType' }, optional: false, locked: true },
            ],
        });
        expect(typeNamed(body, 'TChapter')).toBeUndefined();
    }, 60_000);

    it('reads data types of entities and chapters as fields', async () => {
        const annie = (await t.get('/api/stories/example/entities/characters/annie')).body;
        expect(annie.dataType).toEqual({
            name: 'TAnnieCharacterData',
            code: '{\n    knowsMagic: boolean;\n}',
            fields: [{ key: 'knowsMagic', type: { t: 'boolean' }, optional: false }],
        });
        expect(annie).not.toHaveProperty('userFields');
        const village = (await t.get('/api/stories/example/chapters/village')).body;
        expect(village.dataType.fields).toEqual([
            {
                key: 'mojePromena',
                type: {
                    t: 'object',
                    fields: [
                        { key: 'time', type: { t: 'number' }, optional: false },
                        { key: 'asd', type: { t: 'string' }, optional: false },
                    ],
                },
                optional: false,
            },
        ]);
    });

    describe('with story types, a catalog and user fields', () => {
        beforeAll(async () => {
            await write('types/literals.ts', "export type TMood = 'happy' | 'sad';\nexport type TOdd = 1 | 2;\n");
            await write(
                'types/TRace.ts',
                `import type { races } from '@story/data/catalogs/races';
import { TLocationId } from './TLocation';
import { TMood } from './literals';

export type TRace = {
    name: string;
    /** How strong. */
    strength: number;
    tags: string[];
    mood?: TMood;
    home: TLocationId;
    onMeet: () => void;
    stats: { hp: number };
    odd: Partial<TRaceId>;
};

export type TRaceId = keyof typeof races;
`
            );
            await write(
                'data/catalogs/races.ts',
                `import type { TRace } from '@story/types';

export const races = {
    elf: { name: 'Elf', strength: 2, tags: [], home: 'village', onMeet: () => {}, stats: { hp: 1 }, odd: 'elf' },
    dwarf: { name: 'Dwarf', strength: 5, tags: [], home: 'kingdom', onMeet: () => {}, stats: { hp: 3 }, odd: 'elf' },
} satisfies Record<string, TRace>;
`
            );
            await edit(
                'types/index.ts',
                "export * from './TTimeTrigger';",
                "export * from './TTimeTrigger';\nexport * from './TRace';"
            );
            await edit('types/TCharacter.ts', '    image?: string;\n', '    image?: string;\n    race: TRaceId;\n');
            await edit('types/TCharacter.ts', "from './ids';", "from './ids';\nimport { TRaceId } from './TRace';");
            await edit('types/TCharacter.ts', '    health: number;\n', '    health: number;\n    energy: number;\n');
            await edit(
                'data/characters/thomas.ts',
                'export type TThomasCharacterData',
                "export type TMood = 'x';\n\nexport type TThomasCharacterData"
            );
        });

        it('reads global literals first and reports a duplicate name', async () => {
            const body = await structure();
            expect(body.literals.map((l: TAny) => [l.name, l.scope, l.file])).toEqual([
                ['TMood', 'global', 'types/literals.ts'],
                ['TItemType', 'local', 'data/items/itemInfo.ts'],
            ]);
            expect(body.diagnostics).toEqual([
                expect.objectContaining({
                    file: 'data/characters/thomas.ts',
                    message: expect.stringContaining('"TMood" is already declared in types/literals.ts'),
                }),
            ]);
            expect(typeNamed(body, 'TOdd')).toMatchObject({
                origin: 'story',
                fields: [],
                code: 'export type TOdd = 1 | 2;',
            });
        });

        it('reads a story type with its catalog, mapping each field type', async () => {
            const body = await structure();
            expect(typeNamed(body, 'TRaceId')).toBeUndefined();
            expect(typeNamed(body, 'TRace')).toEqual({
                version: expect.any(String),
                file: 'types/TRace.ts',
                line: 5,
                exportName: 'TRace',
                name: 'TRace',
                origin: 'story',
                catalog: { name: 'races', file: 'data/catalogs/races.ts', idType: 'TRaceId' },
                fields: [
                    { key: 'name', type: { t: 'string' }, optional: false },
                    { key: 'strength', type: { t: 'number' }, optional: false, description: 'How strong.' },
                    { key: 'tags', type: { t: 'array', of: { t: 'string' } }, optional: false },
                    { key: 'mood', type: { t: 'literal', name: 'TMood' }, optional: true },
                    { key: 'home', type: { t: 'ref', name: 'TLocation' }, optional: false },
                    { key: 'onMeet', type: { t: 'function', signature: '() => void' }, optional: false },
                    {
                        key: 'stats',
                        type: { t: 'object', fields: [{ key: 'hp', type: { t: 'number' }, optional: false }] },
                        optional: false,
                    },
                    { key: 'odd', type: { t: 'code', code: 'Partial<TRaceId>' }, optional: false },
                ],
            });
            expect(typeNamed(body, 'TCharacter').fields).toContainEqual({
                key: 'race',
                type: { t: 'ref', name: 'TRace' },
                optional: false,
            });
        });

        it('reads user fields of an entity, and creates one with defaults for the required ones', async () => {
            const thomas = (await t.get('/api/stories/example/entities/characters/thomas')).body;
            expect(thomas.userFields).toEqual({});

            const created = await t.post('/api/stories/example/entities/characters', { id: 'bob' });
            expect(created.status).toBe(201);
            expect(created.body.userFields).toEqual({ race: 'elf' });
            const text = await readFile(t.project.abs('data/characters/bob.ts'), 'utf8');
            expect(text).toContain("race: 'elf'");
            expect(text).toMatch(/init: \{\s*health: 100,\s*inventory: \[\],\s*energy: 0,\s*\}/);

            const updated = await t.put('/api/stories/example/entities/characters/bob', {
                version: created.body.version,
                userFields: { race: 'dwarf' },
            });
            expect(updated.status).toBe(200);
            expect(updated.body.userFields).toEqual({ race: 'dwarf' });
            expect(await readFile(t.project.abs('data/characters/bob.ts'), 'utf8')).toContain("race: 'dwarf'");
        }, 60_000);
    });
});
