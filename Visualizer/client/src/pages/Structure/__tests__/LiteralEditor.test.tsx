import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TItemDto } from '@story/visualizer-protocol';
import {
    click,
    get,
    mountAsync,
    typeInto,
    unmount,
    $$,
} from '../../../components/inputs/__tests__/dom';
import { LiteralEditor } from '../LiteralEditor';
import { StructureEditorStore } from '../StructureEditorStore';
import {
    createMockStores,
    settle,
    type TMockStores,
} from '../../../stores/__tests__/mockStores';

describe('LiteralEditor', () => {
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
        await act(async () => {
            await settle();
            editor.show('literals', 'TItemType');
        });
        await mountAsync(<LiteralEditor editor={editor} />);
    });

    afterEach(() => {
        unmount();
        stop();
        stores.release();
    });

    const values = () => $$('[data-value]').map((el) => el.dataset.value);

    it('shows the scope and the fields using it', () => {
        expect(get('[data-meta="scope"]').textContent).toBe(
            'Local to data/items/itemInfo.ts'
        );
        expect(get('[data-meta="usages"]').textContent).toBe(
            'Used by TItemInfo.type'
        );
        expect(values()).toEqual([
            'value',
            'resource',
            'tool',
            'food',
            'weapon',
        ]);
    });

    const addValue = (value: string) => {
        typeInto(
            get<HTMLInputElement>('input[data-action="add-value"]'),
            value
        );
        act(() => {
            get('input[data-action="add-value"]').dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
            );
        });
    };

    it('adds, renames, moves and removes values, then saves the renames', async () => {
        addValue('gem');
        addValue('ruby');
        typeInto(
            get<HTMLInputElement>('[data-value="value"] input'),
            'valuable'
        );
        click('[data-value="weapon"] [data-action="move-up"]');
        click('[data-value="ruby"] [data-action="remove-row"]');
        expect(values()).toEqual([
            'valuable',
            'resource',
            'tool',
            'weapon',
            'food',
            'gem',
        ]);
        expect(get('[data-value="valuable"]').dataset.state).toBe('renamed');
        expect(get('[data-value="gem"]').dataset.state).toBe('new');

        await act(async () => {
            click('[data-action="save"]');
            await settle();
        });
        expect(stores.structure.literalValues('TItemType')).toEqual([
            'valuable',
            'resource',
            'tool',
            'weapon',
            'food',
            'gem',
        ]);
        expect(
            ((await stores.api.getEntity('items', 'gold')) as TItemDto).type
        ).toBe('valuable');
    });

    it('refuses removing a used value with the references', async () => {
        click('[data-value="food"] [data-action="remove-row"]');
        await act(async () => {
            click('[data-action="save"]');
            await settle();
        });
        expect(get('.MuiAlert-root').textContent).toContain("type: 'food'");
    });

    it('flags a duplicate value', () => {
        typeInto(get<HTMLInputElement>('[data-value="tool"] input'), 'food');
        expect($$('[data-error="true"]')).toHaveLength(2);
    });
});
