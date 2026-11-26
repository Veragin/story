import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DescriptionInput } from '../DescriptionInput';
import { fire, get, mount, unmount } from './dom';
import { Controlled } from './harness';

const FIELD = 'textarea[data-field="docComment"]';

const pressAt = (caret: number, key: string) => {
    const input = get<HTMLTextAreaElement>(FIELD);
    input.focus();
    input.setSelectionRange(caret, caret);
    fire(
        input,
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
    return input;
};

describe('DescriptionInput', () => {
    afterEach(unmount);

    it('continues a bullet list on Enter and keeps the caret in the new item', () => {
        const onChange = vi.fn();
        mount(
            <Controlled initial="• one" onChange={onChange}>
                {(value, change) => (
                    <DescriptionInput value={value} onChange={change} />
                )}
            </Controlled>
        );
        const input = pressAt(5, 'Enter');
        expect(onChange).toHaveBeenLastCalledWith('• one\n• ');
        expect(input.selectionStart).toBe(8);
        pressAt(8, 'Backspace');
        expect(onChange).toHaveBeenLastCalledWith('• one\n');
    });
});
