import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkbox } from '../Checkbox';
import { click, get, mount, unmount } from './dom';
import { Controlled } from './harness';

const BOX = 'input[aria-label="Awake"]';

describe('Checkbox', () => {
    afterEach(unmount);

    it('toggles the value and has no visible label', () => {
        const onChange = vi.fn();
        mount(
            <Controlled initial={false} onChange={onChange}>
                {(value, change) => (
                    <Checkbox
                        value={value}
                        onChange={change}
                        ariaLabel="Awake"
                    />
                )}
            </Controlled>
        );
        expect(document.body.textContent).toBe('');
        click(BOX);
        expect(onChange).toHaveBeenLastCalledWith(true);
        expect(get<HTMLInputElement>(BOX).checked).toBe(true);
        click(BOX);
        expect(onChange).toHaveBeenLastCalledWith(false);
    });
});
