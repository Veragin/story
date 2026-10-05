import '@story/shared'; // installs the global `_`
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TMaybeCode, TTypeRef, TValue } from '@story/visualizer-protocol';
import { ArrayInput } from '../ArrayInput';
import { $$, click, get, mount, typeInto, unmount } from './dom';
import { Controlled, InStructure } from './harness';

describe('ArrayInput', () => {
    afterEach(unmount);

    const render = (initial: TMaybeCode<TValue[]>, itemType?: TTypeRef) => {
        const onChange = vi.fn();
        mount(
            <InStructure>
                <Controlled initial={initial} onChange={onChange}>
                    {(value, change) => (
                        <ArrayInput
                            value={value}
                            onChange={change}
                            itemType={itemType}
                            ariaLabel="Places"
                        />
                    )}
                </Controlled>
            </InStructure>
        );
        return onChange;
    };

    const values = () =>
        $$<HTMLInputElement>('[role="listitem"] input').map((el) => el.value);
    const rowButton = (row: number, action: string) =>
        get(`[role="listitem"]:nth-child(${row}) [data-action="${action}"]`);
    const press = (row: number, action: string) =>
        act(() => rowButton(row, action).click());

    it('adds the default of the item type', () => {
        const onChange = render([], { t: 'ref', name: 'TLocation' });
        click('[data-action="add-item"]');
        expect(onChange).toHaveBeenLastCalledWith(['forest']);
        click('[data-action="add-item"]');
        expect(onChange).toHaveBeenLastCalledWith(['forest', 'forest']);
    });

    it('moves and removes items', () => {
        const onChange = render(['a', 'b', 'c'], { t: 'string' });
        expect(rowButton(1, 'move-up').hasAttribute('disabled')).toBe(true);
        expect(rowButton(3, 'move-down').hasAttribute('disabled')).toBe(true);

        press(1, 'move-down');
        expect(onChange).toHaveBeenLastCalledWith(['b', 'a', 'c']);
        expect(values()).toEqual(['b', 'a', 'c']);

        press(3, 'move-up');
        expect(onChange).toHaveBeenLastCalledWith(['b', 'c', 'a']);

        press(1, 'remove-row');
        expect(onChange).toHaveBeenLastCalledWith(['c', 'a']);
        expect(values()).toEqual(['c', 'a']);
    });

    it('keeps a moved row mounted, so its focus survives', () => {
        render(['a', 'b'], { t: 'string' });
        const first = get<HTMLInputElement>('input[aria-label="Places 1"]');
        press(1, 'move-down');
        expect(get('input[aria-label="Places 2"]')).toBe(first);
    });

    it('edits an item', () => {
        const onChange = render(['a'], { t: 'string' });
        typeInto(get<HTMLInputElement>('input[aria-label="Places 1"]'), 'z');
        expect(onChange).toHaveBeenLastCalledWith(['z']);
    });

    it('infers the item type without one', () => {
        const onChange = render([1, 2]);
        expect(values()).toEqual(['1', '2']);
        click('[data-action="add-item"]');
        expect(onChange).toHaveBeenLastCalledWith([1, 2, 0]);
    });
});
