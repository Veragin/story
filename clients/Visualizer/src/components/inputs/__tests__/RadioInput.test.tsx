import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RadioInput } from '../RadioInput';
import { $$, click, get, mount, unmount } from './dom';
import { Controlled } from './harness';

const OPTIONS = [
    { id: 'global', label: 'Global' },
    { id: 'local', label: 'Local to a file' },
];

describe('RadioInput', () => {
    afterEach(unmount);

    it('lists the options, checks the value and picks another', () => {
        const onChange = vi.fn();
        mount(
            <Controlled initial="global" onChange={onChange}>
                {(value, change) => (
                    <RadioInput
                        value={value}
                        onChange={change}
                        options={OPTIONS}
                        ariaLabel="Scope"
                        row
                    />
                )}
            </Controlled>
        );
        expect(get('[role="radiogroup"]').getAttribute('aria-label')).toBe(
            'Scope'
        );
        expect($$('[data-option]').map((el) => el.textContent)).toEqual([
            'Global',
            'Local to a file',
        ]);
        const checked = () =>
            $$<HTMLInputElement>('input[type="radio"]').map((r) => r.checked);
        expect(checked()).toEqual([true, false]);
        click('[data-option="local"] input');
        expect(onChange).toHaveBeenLastCalledWith('local');
        expect(checked()).toEqual([false, true]);
    });
});
