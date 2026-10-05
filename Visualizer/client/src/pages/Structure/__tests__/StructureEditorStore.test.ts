// @vitest-environment jsdom
import '@story/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TCharacterDto, TItemDto } from '@story/visualizer-protocol';
import { ApiEvents, createMockApi, type TMockApi } from '../../../api';
import { EntityStore } from '../../../stores/EntityStore';
import { StructureStore } from '../../../stores/StructureStore';
import { StructureEditorStore } from '../StructureEditorStore';

const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('StructureEditorStore', () => {
    let api: TMockApi;
    let entities: EntityStore;
    let structure: StructureStore;
    let editor: StructureEditorStore;
    let stop: () => void;

    beforeEach(async () => {
        const events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events });
        entities = new EntityStore({ api, events });
        structure = new StructureStore({ api, events, entities });
        editor = new StructureEditorStore({ structure, entities });
        const releaseEntities = entities.start();
        const stopEditor = editor.start();
        stop = () => {
            stopEditor();
            releaseEntities();
        };
        await flush();
    });

    afterEach(() => stop());

    it('selects a type once the structure is there, and edits it as rows', async () => {
        editor.show('types', 'TRace');
        expect(editor.type.base?.name).toBe('TRace');
        expect(editor.type.draft?.rows.map((r) => r.field.key)).toEqual(['name', 'strength']);
        expect(editor.type.dirty).toBe(false);

        const rows = editor.type.draft?.rows ?? [];
        editor.setRows(
            rows.map((r) => (r.field.key === 'strength' ? { ...r, field: { ...r.field, key: 'power' } } : r))
        );
        expect(editor.type.dirty).toBe(true);
        expect(await editor.type.save()).toBe(true);
        expect(editor.type.dirty).toBe(false);
        expect(structure.type('TRace')?.fields.map((f) => f.key)).toEqual(['name', 'power']);
        // the rename moved the values of every entry
        await flush();
        expect(entities.catalogOf('races').map((e) => e.values)).toEqual([
            { name: 'Elf', power: 3 },
            { name: 'Dwarf', power: 5 },
        ]);
        expect(editor.type.info).toBe('Updated 1 catalog');
    });

    it('fills defaults of a new required field and says which files it touched', async () => {
        editor.show('types', 'TCharacter');
        const rows = editor.type.draft?.rows ?? [];
        editor.setRows([
            ...rows,
            { field: { key: 'energy', type: { t: 'number' }, optional: false }, originalKey: null },
        ]);
        expect(await editor.type.save()).toBe(true);
        expect(editor.type.info).toBe('Updated 2 characters');
        const thomas = (await api.getEntity('characters', 'thomas')) as TCharacterDto;
        expect(thomas.userFields).toEqual({ energy: 0 });
    });

    it('offers to reset values that no longer fit, and resends with resetIncompatible', async () => {
        editor.show('types', 'TRace');
        const rows = editor.type.draft?.rows ?? [];
        editor.setRows(
            rows.map((r) => (r.field.key === 'strength' ? { ...r, field: { ...r.field, type: { t: 'boolean' } } } : r))
        );
        expect(await editor.type.save()).toBe(false);
        expect(editor.canResetIncompatible).toBe(true);
        expect(editor.type.diagnostics).toHaveLength(2);

        expect(await editor.saveTypeResetting()).toBe(true);
        expect(editor.canResetIncompatible).toBe(false);
        await flush();
        expect(entities.catalogOf('races').map((e) => e.values.strength)).toEqual([false, false]);
    });

    it('creates a new local literal in the type file before the type that uses it', async () => {
        editor.show('types', 'TRace');
        editor.addNewLiteral({ name: 'TSize', values: ['small', 'big'] });
        const rows = editor.type.draft?.rows ?? [];
        editor.setRows([
            ...rows,
            { field: { key: 'size', type: { t: 'literal', name: 'TSize' }, optional: true }, originalKey: null },
        ]);
        expect(await editor.type.save()).toBe(true);
        expect(structure.literal('TSize')).toMatchObject({ scope: 'local', file: 'types/TRace.ts' });
        expect(structure.type('TRace')?.fields.map((f) => f.key)).toContain('size');
        expect(editor.type.draft?.newLiterals).toEqual([]);
    });

    it('goes stale when the type changes on disk under unsaved rows; keep mine saves on top', async () => {
        editor.show('types', 'TRace');
        editor.setRows([...(editor.type.draft?.rows ?? []).slice(0, 1)]);
        const base = editor.type.base;
        await api.updateType('TRace', {
            version: base?.version ?? '',
            fields: [...(base?.fields ?? []), { key: 'note', type: { t: 'string' }, optional: true }],
        });
        await flush();
        expect(editor.type.stale?.current?.fields.map((f) => f.key)).toEqual(['name', 'strength', 'note']);

        expect(await editor.type.keepMine()).toBe(true);
        expect(structure.type('TRace')?.fields.map((f) => f.key)).toEqual(['name']);
    });

    it('renames a literal value where it is used, and refuses removing a used one', async () => {
        editor.show('literals', 'TItemType');
        const rows = editor.literal.draft ?? [];
        editor.setLiteralRows(rows.map((r) => (r.value === 'value' ? { ...r, value: 'valuable' } : r)));
        expect(await editor.literal.save()).toBe(true);
        expect(((await api.getEntity('items', 'gold')) as TItemDto).type).toBe('valuable');

        editor.setLiteralRows((editor.literal.draft ?? []).filter((r) => r.value !== 'tool'));
        expect(await editor.literal.save()).toBe(false);
        expect(editor.literal.references?.map((r) => r.text)).toEqual(["type: 'tool'"]);
    });

    it('refuses deleting a used type, deletes an unused one', async () => {
        await structure.updateType('TCharacter', {
            version: structure.type('TCharacter')?.version ?? '',
            fields: [{ key: 'race', type: { t: 'ref', name: 'TRace' }, optional: true }],
        });
        editor.show('types', 'TRace');
        expect(await editor.removeType()).toBe(false);
        expect(editor.type.references?.map((r) => r.text)).toEqual(['TCharacter.race']);

        const created = await structure.createType({ name: 'TClan', fields: [] });
        expect(created.status).toBe('ok');
        editor.show('types', 'TClan');
        expect(await editor.removeType()).toBe(true);
        expect(structure.type('TClan')).toBeUndefined();
        expect(editor.notFound).toBe(true);
    });

    it('marks an unknown name as not found', () => {
        editor.show('literals', 'TNope');
        expect(editor.notFound).toBe(true);
    });
});
