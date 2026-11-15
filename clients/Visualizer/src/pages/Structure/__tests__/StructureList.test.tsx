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

    const render = () => mountAsync(<StructureList editor={editor} />);

    const names = () => $$('[data-name]').map((el) => el.dataset.name);

    it('lists only the classes, never their private types and literals', async () => {
        await render();
        expect(names()).toEqual(['Race', 'Character', 'Location', 'Npc']);
        expect($('[data-action="new-private-type"]')).toBeNull();

        act(() => click('[data-tab="types"]'));
        expect(names()).toContain('TStats');
        expect(names()).not.toContain('TRaceTrait');
        act(() => click('[data-tab="literals"]'));
        expect(names()).not.toContain('TRaceTone');
    });

    it('highlights the class while its private type is selected', async () => {
        await act(async () => {
            editor.show('types', 'TRaceTrait');
            await settle();
        });
        await render();
        expect(get('[data-tab="classes"]').getAttribute('aria-selected')).toBe(
            'true'
        );
        expect(get('[data-name="Race"]').className).toContain('Mui-selected');
    });
});
