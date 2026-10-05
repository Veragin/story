import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StructureContext } from '../../../components/inputs/structureContext';
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

    const render = async (name: string) => {
        await act(async () => {
            editor.show('types', name);
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

    it('shows a story type with its catalog link, and saves an added field', async () => {
        await render('TRace');
        expect(get('h2').textContent).toBe('TRace');
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
        expect(
            stores.structure.type('TRace')?.fields.map((f) => f.key)
        ).toEqual(['name', 'strength', 'field']);
        expect(get('[data-notice="info"]').textContent).toBe(
            'Updated 1 catalog'
        );
    });

    it('offers to reset values that no longer fit', async () => {
        await render('TRace');
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
        expect(stores.structure.type('TRace')?.fields[1]?.type).toEqual({
            t: 'boolean',
        });
    });

    it('keeps engine fields locked and does not delete an extendable type', async () => {
        await render('TCharacter');
        expect(get('[data-key="name"]').dataset.locked).toBe('true');
        expect($('[data-action="delete"]')).toBeNull();
    });

    it('shows an engine type read-only', async () => {
        await render('TChapter');
        expect($('[data-action="save"]')).toBeNull();
        expect(get('pre').textContent).toContain('TChapter');
    });
});
