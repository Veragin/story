import '@story/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TCharacterDto } from '@story/visualizer-protocol';
import { ApiEvents, createMockApi, type TMockApi } from '../../../api';
import { EntityStore } from '../../../stores/EntityStore';
import { CatalogFormStore } from '../CatalogFormStore';

const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('CatalogFormStore', () => {
    let api: TMockApi;
    let entities: EntityStore;
    let store: CatalogFormStore;

    beforeEach(() => {
        const events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events });
        entities = new EntityStore({ api, events });
        store = new CatalogFormStore({ entities, events });
        store.start();
    });

    afterEach(() => store.dispose());

    it('lists a catalog, edits an entry and saves the whole values', async () => {
        await store.show('races', 'elf');
        await flush();
        expect(store.list.map((e) => e.id)).toEqual(['elf', 'dwarf']);
        expect(store.resource.draft).toEqual({ name: 'Elf', strength: 3 });

        store.setValues({ name: 'High elf', strength: 4 });
        expect(store.resource.dirty).toBe(true);
        expect(await store.resource.save()).toBe(true);
        expect((await api.getCatalogEntry('races', 'elf')).values).toEqual({ name: 'High elf', strength: 4 });
        expect(store.list.find((e) => e.id === 'elf')?.values.name).toBe('High elf');
        await flush();
        expect(store.resource.stale).toBeNull();
    });

    it('shows a value that does not fit as diagnostics', async () => {
        await store.show('races', 'dwarf');
        store.setValues({ name: 'Dwarf' });
        expect(await store.resource.save()).toBe(false);
        expect(store.resource.diagnostics.map((d) => d.field)).toEqual(['values.strength']);
    });

    it('goes stale on an external change of the open entry', async () => {
        await store.show('races', 'elf');
        store.setValues({ name: 'Mine', strength: 3 });
        const version = store.resource.base?.version ?? '';
        await api.updateCatalogEntry('races', 'elf', { version, values: { name: 'Theirs', strength: 3 } });
        api.simulateExternalChange('catalog', 'races/elf');
        await flush();
        expect(store.resource.stale?.current?.values.name).toBe('Theirs');
    });

    it('deletes an entry, clearing the values that pointed at it', async () => {
        const structure = await api.getStructure();
        const character = structure.types.find((t) => t.name === 'TCharacter');
        await api.updateType('TCharacter', {
            version: character?.version ?? '',
            fields: [{ key: 'race', type: { t: 'ref', name: 'TRace' }, optional: true }],
        });
        const thomas = await api.getEntity('characters', 'thomas');
        await api.updateEntity('characters', 'thomas', { version: thomas.version, userFields: { race: 'elf' } });

        await store.show('races', 'elf');
        expect(await entities.catalogDeleteReferences('races', 'elf')).toMatchObject({
            cleared: [
                { resource: { kind: 'entity', id: 'characters/thomas' }, path: 'race', change: { op: 'removed' } },
            ],
            blocking: [],
        });
        expect(await store.remove()).toBe(true);
        expect(store.selectedId).toBeNull();
        expect(store.resource.cleared?.map((c) => c.path)).toEqual(['race']);
        expect(((await api.getEntity('characters', 'thomas')) as TCharacterDto).userFields).toEqual({});
        expect(store.list.map((e) => e.id)).toEqual(['dwarf']);
    });

    it('sets a required reference to the first remaining id, and refuses when none is left', async () => {
        const structure = await api.getStructure();
        const character = structure.types.find((t) => t.name === 'TCharacter');
        await api.updateType('TCharacter', {
            version: character?.version ?? '',
            fields: [{ key: 'race', type: { t: 'ref', name: 'TRace' }, optional: false }],
        });
        expect(((await api.getEntity('characters', 'thomas')) as TCharacterDto).userFields).toEqual({ race: 'elf' });

        await store.show('races', 'elf');
        expect(await store.remove()).toBe(true);
        expect(store.resource.cleared?.[0]?.change).toEqual({ op: 'set', value: 'dwarf' });

        await store.show('races', 'dwarf');
        expect(await store.remove()).toBe(false);
        expect(store.resource.references?.map((r) => r.file)).toContain('data/characters/thomas.ts');
    });
});
