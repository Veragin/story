// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiEvents, createMockApi, type TMockApi } from '../../api';
import { EntityStore } from '../EntityStore';
import { StructureStore } from '../StructureStore';

const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('StructureStore', () => {
    let events: ApiEvents;
    let api: TMockApi;
    let entities: EntityStore;
    let store: StructureStore;
    let release: () => void;

    beforeEach(async () => {
        events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events });
        entities = new EntityStore({ api, events });
        store = new StructureStore({ api, events, entities });
        const releaseEntities = entities.start();
        const releaseStructure = store.start();
        release = () => {
            releaseStructure();
            releaseEntities();
        };
        await flush();
    });

    afterEach(() => release());

    it('loads literals and types', () => {
        expect(store.loaded).toBe(true);
        expect(store.literalValues('TItemType')).toContain('weapon');
        expect(store.literalsVisibleFrom('types/Character.ts')).toEqual([]);
        expect(store.literalsVisibleFrom('data/items/itemInfo.ts').map((l) => l.name)).toEqual(['TItemType']);
        expect(store.extendableTypes.map((t) => t.name)).toContain('TItemInfo');
        expect(store.types.map((t) => t.origin)).not.toContain('engine');
        expect(store.storyTypes.map((t) => t.name)).toEqual(['TStats']);
        expect(store.storyClasses.map((t) => t.name)).toEqual(['Race']);
        expect(store.builtInClasses.map((t) => t.name)).toEqual(['Character', 'Location', 'Npc']);
        expect(store.extendableTypes.map((t) => t.name)).toEqual(['TCharacterData', 'TNpcData', 'TItemInfo']);
        expect(store.refTypeNames).toEqual(['Location', 'TItem', 'Character', 'Npc', 'TChapter', 'Race']);
        expect(store.structNamesVisibleFrom('data/characters/thomas.ts')).toEqual(['TStats']);
        expect(store.structFields('TStats').map((f) => f.key)).toEqual(['strength', 'title']);
        expect(store.structFields('Race')).toEqual([]);
        expect(store.userFieldsOf('Character')).toEqual([]);
    });

    it('merges a base type with an entity data type, editing engine code types as values', () => {
        const fields = store.fieldsOf('TCharacterData', {
            name: 'TThomasCharacterData',
            code: '{ knowsMagic: boolean; health: number }',
            fields: [
                { key: 'knowsMagic', type: { t: 'boolean' }, optional: false },
                { key: 'health', type: { t: 'string' }, optional: false },
            ],
        });
        expect(fields.map((f) => [f.key, f.optional])).toEqual([
            ['location', true],
            ['health', false],
            ['inventory', false],
            ['knowsMagic', true],
        ]);
        expect(fields.find((f) => f.key === 'inventory')?.type).toMatchObject({
            t: 'array',
            of: { t: 'object', fields: [{ key: 'id', type: { t: 'ref', name: 'TItem' } }, { key: 'amount' }] },
        });
        expect(store.fieldsOf('TNpcData').find((f) => f.key === 'location')?.type).toEqual({
            t: 'ref',
            name: 'Location',
        });
        expect(store.fieldsOf('TNoSuchType')).toEqual([]);
    });

    it('offers ids of the built-in ref targets', () => {
        expect(store.refOptions('Location')).toEqual([
            { id: 'village', label: 'Village' },
            { id: 'kingdom', label: 'kingdom' },
        ]);
        expect(store.refOptions('TChapter').map((o) => o.id)).toContain('village');
        expect(store.refOptions('Race')).toEqual([
            { id: 'elf', label: 'Elf' },
            { id: 'dwarf', label: 'Dwarf' },
        ]);
        expect(store.refOptions('TNope')).toEqual([]);
    });

    it('lists the private members of a class, visible only from its file', async () => {
        await store.createType({ kind: 'type', name: 'TRaceTrait', fields: [], owner: 'Race' });
        await store.createLiteral({ name: 'TRaceTone', values: ['low'], owner: 'Race' });
        await flush();
        const members = store.privateOf('Race');
        expect(members.types.map((t) => t.name)).toEqual(['TRaceTrait']);
        expect(members.literals.map((l) => l.name)).toEqual(['TRaceTone']);
        expect(store.privateOf('Character')).toEqual({ types: [], literals: [] });
        expect(store.publicStoryTypes.map((t) => t.name)).not.toContain('TRaceTrait');
        expect(store.publicLiterals.map((l) => l.name)).not.toContain('TRaceTone');
        expect(store.structNamesVisibleFrom('types/Race.ts')).toContain('TRaceTrait');
        expect(store.structNamesVisibleFrom('types/TStats.ts')).not.toContain('TRaceTrait');
        expect(store.literalsVisibleFrom('types/Race.ts').map((l) => l.name)).toContain('TRaceTone');
        expect(store.literalsVisibleFrom('data/characters/hero.ts').map((l) => l.name)).not.toContain('TRaceTone');

        const outside = await store.createType({
            kind: 'type',
            name: 'TBanner',
            fields: [{ key: 'tone', type: { t: 'literal', name: 'TRaceTone' }, optional: false }],
        });
        expect(outside.status).toBe('invalid');

        const race = store.type('Race');
        expect(race).toBeDefined();
        if (!race) return;
        expect((await store.deleteType('Race', race.version)).status).toBe('ok');
        await flush();
        expect(store.type('TRaceTrait')).toBeUndefined();
        expect(store.literal('TRaceTone')).toBeUndefined();
    });

    it('adds a literal value at once', async () => {
        expect(await store.addLiteralValue('TItemType', 'gem')).toBe(true);
        expect(store.literalValues('TItemType')).toContain('gem');
        expect(await store.addLiteralValue('TItemType', 'gem')).toBe(true);
        expect(store.literalValues('TItemType').filter((v) => v === 'gem')).toHaveLength(1);
        expect(await store.addLiteralValue('TNope', 'x')).toBe(false);
        expect(store.writeError).toMatch(/TNope/);
    });

    it('returns refused writes as results', async () => {
        expect(await store.createType({ kind: 'type', name: 'Race', fields: [] })).toMatchObject({
            status: 'invalid',
            diagnostics: [{ field: 'name' }],
        });
        expect(
            await store.createType({ kind: 'class', name: 'TClan', fields: [], catalog: { name: 'clans' } })
        ).toMatchObject({ status: 'invalid', diagnostics: [{ field: 'name' }] });
        const created = await store.createType({
            kind: 'class',
            name: 'Clan',
            fields: [],
            catalog: { name: 'clans' },
        });
        expect(created).toMatchObject({
            status: 'ok',
            value: { name: 'Clan', kind: 'class', catalog: { idType: 'TClanId' } },
        });
        expect(store.refTypeNames).toContain('Clan');
        const type = await store.createType({ kind: 'type', name: 'TOrigin', fields: [] });
        expect(type).toMatchObject({ status: 'ok', value: { name: 'TOrigin', kind: 'type' } });
        expect(store.refTypeNames).not.toContain('TOrigin');
        expect(store.storyTypes.map((t) => t.name)).toContain('TOrigin');
        expect(await store.deleteType('Clan', 'not-the-version')).toMatchObject({ status: 'stale' });
    });

    it('reloads on a structure event', async () => {
        const before = store.structure;
        api.simulateExternalChange('structure', 'structure');
        await flush();
        expect(store.structure).not.toBe(before);
    });

    it('keeps the subscription while any page holds it', async () => {
        const second = store.start();
        release();
        const before = store.structure;
        api.simulateExternalChange('structure', 'structure');
        await flush();
        expect(store.structure).not.toBe(before);
        second();
        const after = store.structure;
        api.simulateExternalChange('structure', 'structure');
        await flush();
        expect(store.structure).toBe(after);
        release = () => {};
    });
});
