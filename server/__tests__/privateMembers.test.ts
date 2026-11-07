import { access, readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TAny } from './helpers/http';
import { startSourceApp, tscTemp } from './helpers/sourceHelpers';

let t: Awaited<ReturnType<typeof startSourceApp>>;

const API = '/api/stories/example/structure';
const GUILD_FILE = 'types/Guild.ts';

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

const field = (key: string, type: TAny, optional = false) => ({ key, type, optional });

describe('private types and literals', () => {
    it('declares a private literal and type in the class file, not exported and not in the barrel', async () => {
        const guild = await t.post(`${API}/types`, {
            kind: 'class',
            name: 'Guild',
            fields: [field('name', { t: 'string' })],
            catalog: { name: 'guilds' },
        });
        expect(guild.status, JSON.stringify(guild.body)).toBe(201);

        const rank = await t.post(`${API}/literals`, { name: 'TRank', values: ['novice', 'master'], owner: 'Guild' });
        expect(rank.status, JSON.stringify(rank.body)).toBe(201);
        expect(rank.body).toMatchObject({ scope: 'private', owner: 'Guild', file: GUILD_FILE });

        const crest = await t.post(`${API}/types`, {
            kind: 'type',
            name: 'TCrest',
            owner: 'Guild',
            fields: [field('rank', { t: 'literal', name: 'TRank' }), field('colour', { t: 'string' })],
        });
        expect(crest.status, JSON.stringify(crest.body)).toBe(201);
        expect(crest.body).toMatchObject({ kind: 'type', owner: 'Guild', file: GUILD_FILE });

        const text = await read(GUILD_FILE);
        expect(text).toContain("type TRank = 'novice' | 'master';");
        expect(text).toMatch(/^type TCrest = \{/m);
        expect(text).not.toContain('export type TRank');
        expect(text).not.toContain('export type TCrest');
        expect(text).not.toMatch(/import .*TRank/);
        expect(await read('types/index.ts')).not.toMatch(/TCrest|TRank/);
        expect(await exists('types/TCrest.ts')).toBe(false);
    }, 60_000);

    it('uses the private type in its class without an import, and updates it in place', async () => {
        const guild = await typeNamed('Guild');
        const used = await t.put(`${API}/types/Guild`, {
            version: guild.version,
            fields: [...guild.fields, field('crest', { t: 'struct', name: 'TCrest' }, true)],
        });
        expect(used.status, JSON.stringify(used.body)).toBe(200);
        expect(await read(GUILD_FILE)).not.toMatch(/import .*TCrest/);

        const crest = await typeNamed('TCrest');
        const updated = await t.put(`${API}/types/TCrest`, {
            version: crest.version,
            fields: [...crest.fields, field('motto', { t: 'string' }, true)],
        });
        expect(updated.status, JSON.stringify(updated.body)).toBe(200);
        expect(updated.body.type).toMatchObject({ owner: 'Guild', file: GUILD_FILE });
        expect(updated.body.type.fields.map((f: TAny) => f.key)).toEqual(['rank', 'colour', 'motto']);
        expect(await read(GUILD_FILE)).not.toContain('export type TCrest');

        const rank = await literalNamed('TRank');
        const added = await t.post(`${API}/literals/TRank/values`, { value: 'elder' });
        expect(added.status).toBe(200);
        expect(added.body).toMatchObject({ scope: 'private', values: [...rank.values, 'elder'] });
        expect((await tscTemp(t.project.root)).output).toBe('');
    }, 60_000);

    it('refuses a private type or literal used outside its class file', async () => {
        const outside = (fields: TAny[]) => t.post(`${API}/types`, { kind: 'type', name: 'TBanner', fields });
        const type = await outside([field('crest', { t: 'struct', name: 'TCrest' })]);
        expect(type.status).toBe(422);
        expect(type.body.message).toContain('private to class Guild');
        expect((await outside([field('rank', { t: 'literal', name: 'TRank' })])).status).toBe(422);
        const nested = await outside([field('ranks', { t: 'array', of: { t: 'literal', name: 'TRank' } })]);
        expect(nested.status).toBe(422);

        const character = await typeNamed('Character');
        const fromClass = await t.put(`${API}/types/Character`, {
            version: character.version,
            fields: [
                ...character.fields.filter((f: TAny) => !f.locked),
                field('crest', { t: 'struct', name: 'TCrest' }, true),
            ],
        });
        expect(fromClass.status).toBe(422);
        expect(await typeNamed('TBanner')).toBeUndefined();
    }, 60_000);

    it('validates the owner', async () => {
        const privateType = (owner: unknown) =>
            t.post(`${API}/types`, { kind: 'type', name: 'TBadge', owner, fields: [] });
        expect((await privateType('Nobody')).status).toBe(404);
        expect((await privateType('TChapter')).status).toBe(404);
        expect((await privateType(42)).status).toBe(400);
        const privateClass = await t.post(`${API}/types`, {
            kind: 'class',
            name: 'Badge',
            owner: 'Guild',
            fields: [],
            catalog: { name: 'badges' },
        });
        expect(privateClass.status).toBe(400);
        const both = await t.post(`${API}/literals`, {
            name: 'TBadgeKind',
            values: ['x'],
            owner: 'Guild',
            file: 'types/literals.ts',
        });
        expect(both.status).toBe(400);
        const taken = await t.post(`${API}/literals`, { name: 'TRank', values: ['x'], owner: 'Character' });
        expect(taken.status).toBe(409);
    }, 60_000);

    it('lets a built-in class own private members', async () => {
        const mood = await t.post(`${API}/literals`, { name: 'TTemper', values: ['calm', 'wild'], owner: 'Character' });
        expect(mood.status, JSON.stringify(mood.body)).toBe(201);
        expect(mood.body).toMatchObject({ scope: 'private', owner: 'Character', file: 'types/Character.ts' });
        expect(await read('types/Character.ts')).not.toContain('export type TTemper');
        expect((await tscTemp(t.project.root)).output).toBe('');
        expect((await t.del(`${API}/literals/TTemper`, { version: mood.body.version })).status).toBe(200);
        expect(await read('types/Character.ts')).not.toContain('TTemper');
    }, 60_000);

    it('counts a use inside the class file as a reference, and deletes an unused private type', async () => {
        const crest = await typeNamed('TCrest');
        const usedType = await t.del(`${API}/types/TCrest`, { version: crest.version });
        expect(usedType.status).toBe(409);
        expect(usedType.body.references).toEqual([expect.objectContaining({ file: GUILD_FILE })]);
        const rank = await literalNamed('TRank');
        const usedLiteral = await t.del(`${API}/literals/TRank`, { version: rank.version });
        expect(usedLiteral.status).toBe(409);

        const spare = await t.post(`${API}/types`, { kind: 'type', name: 'TSpare', owner: 'Guild', fields: [] });
        expect(spare.status).toBe(201);
        expect((await t.del(`${API}/types/TSpare`, { version: spare.body.version })).status).toBe(200);
        const text = await read(GUILD_FILE);
        expect(text).not.toContain('TSpare');
        expect(text).toContain('export class Guild');
    }, 60_000);

    it('deletes the class together with its private types and literals', async () => {
        const guild = await typeNamed('Guild');
        const deleted = await t.del(`${API}/types/Guild`, { version: guild.version });
        expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
        expect(await exists(GUILD_FILE)).toBe(false);
        const after = await structure();
        expect(after.types.map((type: TAny) => type.name)).not.toEqual(expect.arrayContaining(['TCrest']));
        expect(after.literals.map((literal: TAny) => literal.name)).not.toContain('TRank');
    }, 60_000);
});
