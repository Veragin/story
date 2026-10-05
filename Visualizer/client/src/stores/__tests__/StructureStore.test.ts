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
        expect(store.literalsVisibleFrom('types/TCharacter.ts')).toEqual([]);
        expect(store.literalsVisibleFrom('data/items/itemInfo.ts').map((l) => l.name)).toEqual(['TItemType']);
        expect(store.extendableTypes.map((t) => t.name)).toContain('TItemInfo');
        expect(store.types.map((t) => t.origin)).not.toContain('engine');
        expect(store.storyTypes.map((t) => t.name)).toEqual(['TRace']);
        expect(store.refTypeNames).toEqual(['TLocation', 'TItem', 'TCharacter', 'TNpc', 'TChapter', 'TRace']);
        expect(store.userFieldsOf('TCharacter')).toEqual([]);
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
            name: 'TLocation',
        });
        expect(store.fieldsOf('TNoSuchType')).toEqual([]);
    });

    it('offers ids of the built-in ref targets', () => {
        expect(store.refOptions('TLocation')).toEqual([
            { id: 'village', label: 'Village' },
            { id: 'kingdom', label: 'kingdom' },
        ]);
        expect(store.refOptions('TChapter').map((o) => o.id)).toContain('village');
        expect(store.refOptions('TRace')).toEqual([
            { id: 'elf', label: 'Elf' },
            { id: 'dwarf', label: 'Dwarf' },
        ]);
        expect(store.refOptions('TNope')).toEqual([]);
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
        expect(await store.createType({ name: 'TRace', fields: [] })).toMatchObject({
            status: 'invalid',
            diagnostics: [{ field: 'name' }],
        });
        const created = await store.createType({ name: 'TClan', fields: [], catalog: { name: 'clans' } });
        expect(created).toMatchObject({ status: 'ok', value: { name: 'TClan', catalog: { idType: 'TClanId' } } });
        expect(store.refTypeNames).toContain('TClan');
        expect(await store.deleteType('TClan', 'not-the-version')).toMatchObject({ status: 'stale' });
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
