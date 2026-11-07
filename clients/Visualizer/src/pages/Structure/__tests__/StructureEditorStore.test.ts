// @vitest-environment jsdom
import '@story/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TCharacterDto, TItemDto } from '@story/protocol';
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
        editor.show('types', 'Race');
        expect(editor.type.base?.name).toBe('Race');
        expect(editor.type.draft?.rows.map((r) => r.field.key)).toEqual(['name', 'strength']);
        expect(editor.type.dirty).toBe(false);

        const rows = editor.type.draft?.rows ?? [];
        editor.setRows(
            rows.map((r) => (r.field.key === 'strength' ? { ...r, field: { ...r.field, key: 'power' } } : r))
        );
        expect(editor.type.dirty).toBe(true);
        expect(await editor.type.save()).toBe(true);
        expect(editor.type.dirty).toBe(false);
        expect(structure.type('Race')?.fields.map((f) => f.key)).toEqual(['name', 'power']);
        // the rename moved the values of every entry
        await flush();
        expect(entities.catalogOf('races').map((e) => e.values)).toEqual([
            { name: 'Elf', power: 3 },
            { name: 'Dwarf', power: 5 },
        ]);
        expect(editor.type.info).toBe('Updated 1 catalog');
    });

    it('fills defaults of a new required field and says which files it touched', async () => {
        editor.show('types', 'Character');
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
        editor.show('types', 'Race');
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

    const addLiteralField = (name: string) => {
        editor.addNewLiteral({ name, values: ['small', 'big'] });
        const rows = editor.type.draft?.rows ?? [];
        editor.setRows([
            ...rows,
            { field: { key: 'size', type: { t: 'literal', name }, optional: true }, originalKey: null },
        ]);
    };

    it('creates a new literal of a class as private, before the class that uses it', async () => {
        editor.show('classes', 'Race');
        addLiteralField('TSize');
        expect(await editor.type.save()).toBe(true);
        expect(structure.literal('TSize')).toMatchObject({ scope: 'private', owner: 'Race', file: 'types/Race.ts' });
        expect(structure.type('Race')?.fields.map((f) => f.key)).toContain('size');
        expect(editor.type.draft?.newLiterals).toEqual([]);
    });

    it('creates a new literal of a public type as local to its file', async () => {
        editor.show('types', 'TStats');
        addLiteralField('TBulk');
        expect(await editor.type.save()).toBe(true);
        expect(structure.literal('TBulk')).toMatchObject({ scope: 'local', file: 'types/TStats.ts' });
    });

    it('goes stale when the type changes on disk under unsaved rows; keep mine saves on top', async () => {
        editor.show('types', 'Race');
        editor.setRows([...(editor.type.draft?.rows ?? []).slice(0, 1)]);
        const base = editor.type.base;
        await api.updateType('Race', {
            version: base?.version ?? '',
            fields: [...(base?.fields ?? []), { key: 'note', type: { t: 'string' }, optional: true }],
        });
        await flush();
        expect(editor.type.stale?.current?.fields.map((f) => f.key)).toEqual(['name', 'strength', 'note']);

        expect(await editor.type.keepMine()).toBe(true);
        expect(structure.type('Race')?.fields.map((f) => f.key)).toEqual(['name']);
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
        await structure.updateType('Character', {
            version: structure.type('Character')?.version ?? '',
            fields: [{ key: 'race', type: { t: 'ref', name: 'Race' }, optional: true }],
        });
        editor.show('types', 'Race');
        expect(await editor.removeType()).toBe(false);
        expect(editor.type.references?.map((r) => r.text)).toEqual(['Character.race']);

        const created = await structure.createType({ kind: 'type', name: 'TClan', fields: [] });
        expect(created.status).toBe('ok');
        editor.show('types', 'TClan');
        expect(await editor.removeType()).toBe(true);
        expect(structure.type('TClan')).toBeUndefined();
        expect(editor.notFound).toBe(true);
    });

    it('migrates the values nested at fields of an updated type', async () => {
        const race = structure.type('Race');
        await structure.updateType('Race', {
            version: race?.version ?? '',
            fields: [...(race?.fields ?? []), { key: 'stats', type: { t: 'struct', name: 'TStats' }, optional: true }],
        });
        const elf = await api.getCatalogEntry('races', 'elf');
        await api.updateCatalogEntry('races', 'elf', {
            version: elf.version,
            values: { ...elf.values, stats: { strength: 2, title: 'Sir' } },
        });

        editor.show('types', 'TStats');
        editor.setRows(
            (editor.type.draft?.rows ?? []).map((r) =>
                r.field.key === 'strength' ? { ...r, field: { ...r.field, key: 'power' } } : r
            )
        );
        expect(await editor.type.save()).toBe(true);
        expect((await api.getCatalogEntry('races', 'elf')).values.stats).toEqual({ power: 2, title: 'Sir' });
        expect(editor.type.info).toBe('Updated 1 catalog');
    });

    it('marks an unknown name as not found', () => {
        editor.show('literals', 'TNope');
        expect(editor.notFound).toBe(true);
    });
});
