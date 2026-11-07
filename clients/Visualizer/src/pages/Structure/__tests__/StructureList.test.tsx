import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    $,
    $$,
    click,
    get,
    mountAsync,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { ModalHost } from '../../../shell/ModalHost';
import { modals } from '../../../shell/modals';
import { StructureEditorStore } from '../StructureEditorStore';
import { StructureList } from '../StructureList';
import {
    createMockStores,
    settle,
    type TMockStores,
} from '../../../stores/__tests__/mockStores';

describe('StructureList', () => {
    let stores: TMockStores;
    let editor: StructureEditorStore;
    let stop: () => void;

    beforeEach(async () => {
        stores = createMockStores();
        editor = new StructureEditorStore({
            structure: stores.structure,
            entities: stores.entities,
        });
        stop = editor.start();
        await act(settle);
        await act(async () => {
            await stores.structure.createType({
                kind: 'type',
                name: 'TRaceTrait',
                fields: [],
                owner: 'Race',
            });
            await stores.structure.createLiteral({
                name: 'TRaceTone',
                values: ['low'],
                owner: 'Race',
            });
            await settle();
        });
    });

    afterEach(() => {
        act(() => modals.closeAll());
        unmount();
        stop();
        stores.release();
    });

    const render = () =>
        mountAsync(
            <>
                <StructureList editor={editor} />
                <ModalHost />
            </>
        );

    const names = () => $$('[data-name]').map((el) => el.dataset.name);

    it('nests the private types and literals under their class', async () => {
        await render();
        const shown = names();
        expect(
            shown.slice(shown.indexOf('Race'), shown.indexOf('Race') + 3)
        ).toEqual(['Race', 'TRaceTrait', 'TRaceTone']);
        expect(get('[data-name="Race"]').dataset.depth).toBe('0');
        expect(get('[data-name="TRaceTrait"]').dataset.depth).toBe('1');
        expect(get('[data-name="TRaceTrait"]').getAttribute('href')).toContain(
            'types/TRaceTrait'
        );
        expect(get('[data-name="TRaceTone"]').getAttribute('href')).toContain(
            'literals/TRaceTone'
        );
        expect(
            $('[data-actions-of="Race"] [data-action="new-private-type"]')
        ).not.toBeNull();
        expect(
            $('[data-actions-of="Race"] [data-action="new-private-literal"]')
        ).not.toBeNull();

        act(() => click('[data-tab="types"]'));
        expect(names()).toContain('TStats');
        expect(names()).not.toContain('TRaceTrait');
        act(() => click('[data-tab="literals"]'));
        expect(names()).not.toContain('TRaceTone');
    });

    it('stays on the classes tab while a private type is selected', async () => {
        await act(async () => {
            editor.show('types', 'TRaceTrait');
            await settle();
        });
        await render();
        expect(get('[data-name="TRaceTrait"]').className).toContain(
            'Mui-selected'
        );
    });

    it('opens the private type and literal dialogs for the class', async () => {
        await render();
        await act(async () => {
            click('[data-actions-of="Race"] [data-action="new-private-type"]');
            await settle();
        });
        expect(get('[role=dialog]').textContent).toContain(
            'New private type of Race'
        );
        act(() => modals.closeAll());

        await act(async () => {
            click(
                '[data-actions-of="Race"] [data-action="new-private-literal"]'
            );
            await settle();
        });
        expect(get('[role=dialog]').textContent).toContain(
            'New private literal of Race'
        );
    });
});
