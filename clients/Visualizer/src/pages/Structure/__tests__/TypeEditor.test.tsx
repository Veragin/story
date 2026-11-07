import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StructureContext } from '../../../structure/structureContext';
import {
    $,
    click,
    flush,
    get,
    mountAsync,
    selectOption,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { StructureEditorStore } from '../StructureEditorStore';
import { TypeEditor } from '../TypeEditor';
import {
    createMockStores,
    settle,
    type TMockStores,
} from '../../../stores/__tests__/mockStores';

describe('TypeEditor', () => {
    let stores: TMockStores;
    let editor: StructureEditorStore;
    let stop: () => void;

    const render = async (
        name: string,
        section: 'classes' | 'types' = 'classes'
    ) => {
        await act(async () => {
            editor.show(section, name);
            await settle();
        });
        await mountAsync(
            <StructureContext.Provider value={stores.structure}>
                <TypeEditor editor={editor} />
            </StructureContext.Provider>
        );
    };

    beforeEach(async () => {
        stores = createMockStores();
        editor = new StructureEditorStore({
            structure: stores.structure,
            entities: stores.entities,
        });
        stop = editor.start();
        await act(settle);
    });

    afterEach(() => {
        unmount();
        stop();
        stores.release();
    });

    it('shows a story class with its catalog link, and saves an added field', async () => {
        await render('Race');
        expect(get('h2').textContent).toBe('Race');
        expect(get('.MuiChip-label').textContent).toBe('Class');
        expect(get('[data-meta="origin"]').textContent).toContain('TRaceId');
        expect(get('[data-meta="catalog"]').textContent).toBe(
            '2 races → open in Entities'
        );
        expect(get<HTMLButtonElement>('[data-action="save"]').disabled).toBe(
            true
        );

        click('[data-action="add-structure-field"]');
        expect(get<HTMLButtonElement>('[data-action="save"]').disabled).toBe(
            false
        );
        await act(async () => {
            click('[data-action="save"]');
            await settle();
        });
        expect(stores.structure.type('Race')?.fields.map((f) => f.key)).toEqual(
            ['name', 'strength', 'field']
        );
        expect(get('[data-notice="info"]').textContent).toBe(
            'Updated 1 catalog'
        );
    });

    it('offers to reset values that no longer fit', async () => {
        await render('Race');
        selectOption(
            get<HTMLSelectElement>(
                '[data-key="strength"] [data-field="type-kind"]'
            ),
            'boolean'
        );
        await act(async () => {
            click('[data-action="save"]');
            await settle();
        });
        expect($('[data-action="reset-incompatible"]')).not.toBeNull();
        await act(async () => {
            click('[data-action="reset-incompatible"]');
            await settle();
        });
        await flush();
        expect($('[data-action="reset-incompatible"]')).toBeNull();
        expect(stores.structure.type('Race')?.fields[1]?.type).toEqual({
            t: 'boolean',
        });
    });

    it('shows a story type without a catalog link, and offers its delete', async () => {
        await render('TStats', 'types');
        expect(get('h2').textContent).toBe('TStats');
        expect(get('.MuiChip-label').textContent).toBe('Type');
        expect($('[data-meta="catalog"]')).toBeNull();
        expect($('[data-action="delete"]')).not.toBeNull();
    });

    it('keeps engine fields locked and does not delete an extendable type', async () => {
        await render('Character');
        expect(get('[data-key="name"]').dataset.locked).toBe('true');
        expect($('[data-action="delete"]')).toBeNull();
    });

    it('shows a private type as such, and creates a new literal of a class as private', async () => {
        await act(async () => {
            await stores.structure.createType({
                kind: 'type',
                name: 'TRaceTrait',
                fields: [],
                owner: 'Race',
            });
        });
        await render('TRaceTrait', 'types');
        expect(get('.MuiChip-label').textContent).toBe('Private type of Race');
        expect(get('[data-meta="origin"]').textContent).toContain(
            'usable only in class Race'
        );
        unmount();

        await render('Race');
        act(() => {
            editor.addNewLiteral({ name: 'TRaceTone', values: ['low'] });
            editor.setRows([
                ...(editor.type.draft?.rows ?? []),
                {
                    field: {
                        key: 'tone',
                        type: { t: 'literal', name: 'TRaceTone' },
                        optional: true,
                    },
                    originalKey: null,
                },
            ]);
        });
        await act(async () => {
            click('[data-action="save"]');
            await settle();
        });
        expect(stores.structure.literal('TRaceTone')).toMatchObject({
            scope: 'private',
            owner: 'Race',
            file: 'types/Race.ts',
        });
    });
});
