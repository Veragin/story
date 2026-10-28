import '@story/shared'; // installs the global `_`
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectInput } from '../SelectInput';
import { $$, get, mount, unmount } from './dom';

const OPTIONS = [
    { id: 'time', label: 'Time only' },
    { id: 'object', label: 'Time, items, tools' },
];

const openMenu = () => {
    const button = get('[role="combobox"]');
    act(() => {
        button.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, button: 0 })
        );
    });
};

describe('SelectInput', () => {
    afterEach(unmount);

    it('shows the label of the value and picks an option', () => {
        const onChange = vi.fn();
        mount(
            <SelectInput
                value="time"
                onChange={onChange}
                options={OPTIONS}
                ariaLabel="Kind"
                dataField="kind"
            />
        );
        expect(get('[role="combobox"][aria-label="Kind"]').textContent).toBe(
            'Time only'
        );
        expect(get<HTMLInputElement>('input[data-field="kind"]').value).toBe(
            'time'
        );
        openMenu();
        expect($$('[data-option]').map((li) => li.textContent)).toEqual([
            'Time only',
            'Time, items, tools',
        ]);
        act(() => get('[data-option="object"]').click());
        expect(onChange).toHaveBeenCalledWith('object');
    });
});
