// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TCharacterDto, TEntityDto, TItemDto } from '@story/visualizer-protocol';
import { ApiError, ApiEvents, createMockApi, type TMockApi } from '../../../api';
import { EntitiesStore } from '../EntitiesStore';

const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('EntitiesStore', () => {
    let events: ApiEvents;
    let api: TMockApi;
    let store: EntitiesStore;

    beforeEach(() => {
        sessionStorage.clear();
        events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events });
        store = new EntitiesStore({ api, events });
        store.start();
    });

    afterEach(() => store.dispose());

    it('lists a kind and selects an entity', async () => {
        await store.show('characters');
        expect(store.list.map((e) => e.id)).toEqual(['thomas', 'annie']);
        expect(store.draft).toBeNull();

        await store.show('characters', 'thomas');
        expect(store.selectedId).toBe('thomas');
        expect(store.draft?.id).toBe('thomas');
        expect(store.dirty).toBe(false);

        await store.show('items', 'bow');
        expect(store.list.map((e) => e.id)).toContain('berries');
        expect((store.draft as TItemDto).source).toBe('itemInfo');
    });

    it('marks an unknown id as not found', async () => {
        await store.show('npcs', 'nobody');
        expect(store.notFound).toBe(true);
        expect(store.draft).toBeNull();
    });

    it('edits and saves only the changed fields', async () => {
        await store.show('characters', 'thomas');
        const before = store.base!.version;
        store.setField('name', 'Tom');
        store.setField('init', { ...(store.draft as TCharacterDto).init, health: 50 });
        expect(store.dirty).toBe(true);
        expect(Object.keys(store.changes).sort()).toEqual(['init', 'name']);
        expect(store.hasDraft('characters', 'thomas')).toBe(true);

        expect(await store.save()).toBe(true);
        expect(store.dirty).toBe(false);
        expect(store.base!.version).not.toBe(before);
        expect(store.hasDraft('characters', 'thomas')).toBe(false);
        const onServer = (await api.getEntity('characters', 'thomas')) as TCharacterDto;
        expect(onServer.name).toBe('Tom');
        expect((onServer.init as Record<string, unknown>).health).toBe(50);
        expect(store.list.find((e) => e.id === 'thomas')).toMatchObject({ name: 'Tom' });

        // the own save's echo event does not turn into a stale notice
        await flush();
        expect(store.stale).toBeNull();
    });

    it('refetches a clean form in place on an external change', async () => {
        await store.show('npcs', 'franta');
        await api.updateEntity('npcs', 'franta', { version: store.base!.version, name: 'František' });
        // the mock marks its own writes as saved; pretend the author edited the file by hand
        api.simulateExternalChange('entity', 'npcs/franta');
        await flush();
        expect(store.stale).toBeNull();
        expect((store.draft as TEntityDto & { name: string }).name).toBe('František');
    });

    it('keeps unsaved input on an external change and offers reload / keep mine', async () => {
        await store.show('npcs', 'franta');
        store.setField('description', 'mine');
        api.simulateExternalChange('entity', 'npcs/franta');
        await flush();
        expect(store.stale?.current?.id).toBe('franta');
        expect((store.draft as { description: string }).description).toBe('mine');

        expect(await store.keepMine()).toBe(true);
        expect(store.stale).toBeNull();
        const onServer = await api.getEntity('npcs', 'franta');
        expect(onServer.description).toBe('mine');
    });

    it('handles 409 stale on save; reload takes the version on disk', async () => {
        await store.show('locations', 'village');
        const version = store.base!.version;
        store.dispose(); // no live refresh: the conflict is found by the save itself
        await api.updateEntity('locations', 'village', { version, name: 'Theirs' });
        store.setField('name', 'Mine');

        expect(await store.save()).toBe(false);
        expect(store.stale?.current).toMatchObject({ name: 'Theirs' });
        expect((store.draft as { name: string }).name).toBe('Mine');

        store.reload();
        expect(store.stale).toBeNull();
        expect(store.dirty).toBe(false);
        expect((store.draft as { name: string }).name).toBe('Theirs');
    });

    it('shows 422 diagnostics', async () => {
        await store.show('characters', 'annie');
        const diagnostics = [
            { file: 'data/characters/annie.ts', line: 3, column: 5, message: 'bad', field: 'init.health' },
        ];
        api.updateEntity = () => Promise.reject(new ApiError(422, { error: 'invalid', diagnostics }));
        store.setField('init', { code: 'nope(' });
        expect(await store.save()).toBe(false);
        expect(store.diagnostics).toEqual(diagnostics);
        expect(store.fieldDiagnostics('init')).toHaveLength(1);
        expect(store.dirty).toBe(true);
    });

    it('creates an entity', async () => {
        await store.show('characters');
        const created = await store.create('characters', { id: 'bob', name: 'Bob' });
        expect(created.id).toBe('bob');
        expect(store.list.map((e) => e.id)).toContain('bob');
        await store.show('characters', 'bob');
        expect((store.draft as TCharacterDto).name).toBe('Bob');
        await expect(store.create('characters', { id: 'bob', name: 'Bob' })).rejects.toMatchObject({
            status: 409,
        });
    });

    it('deletes an entity', async () => {
        await store.show('npcs', 'nobleMan');
        expect(await store.remove()).toBe(true);
        expect(store.selectedId).toBeNull();
        expect(store.list.map((e) => e.id)).not.toContain('nobleMan');
        await expect(api.getEntity('npcs', 'nobleMan')).rejects.toMatchObject({ status: 404 });
    });

    it('refuses to delete a referenced entity and lists the references', async () => {
        const references = [{ file: 'data/characters/thomas.ts', line: 10, text: "inventory: [{ id: 'bow' }]" }];
        api.deleteEntity = () => Promise.reject(new ApiError(409, { error: 'referenced', references }));
        await store.show('items', 'bow');
        expect(await store.remove()).toBe(false);
        expect(store.references).toEqual(references);
        expect(store.selectedId).toBe('bow');
        expect(store.list.map((e) => e.id)).toContain('bow');
    });

    it('keeps the selection and unsaved input across a reload (ui-state)', async () => {
        await store.show('characters', 'annie');
        store.setField('name', 'Anna');
        store.dispose();

        const again = new EntitiesStore({ api, events });
        expect(again.kind).toBe('characters');
        expect(again.lastIdOf('characters')).toBe('annie');
        await again.show('characters', 'annie');
        expect((again.draft as TCharacterDto).name).toBe('Anna');
        expect(again.dirty).toBe(true);
        expect(again.stale).toBeNull();
    });

    it('restores a draft over a newer version with the stale notice', async () => {
        await store.show('characters', 'annie');
        store.setField('name', 'Anna');
        store.dispose();
        api.simulateExternalChange('entity', 'characters/annie');
        await flush();

        const again = new EntitiesStore({ api, events });
        await again.show('characters', 'annie');
        expect((again.draft as TCharacterDto).name).toBe('Anna');
        expect(again.stale?.current?.id).toBe('annie');
    });

    it('offers to re-create an entity deleted on disk', async () => {
        await store.show('characters', 'thomas');
        store.setField('name', 'Tommy');
        await api.deleteEntity('characters', 'thomas', { version: store.base!.version });
        await flush();
        expect(store.stale).toEqual({ current: null });
        expect(await store.keepMine()).toBe(true);
        expect(((await api.getEntity('characters', 'thomas')) as TCharacterDto).name).toBe('Tommy');
    });
});
