import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NumberInput } from '../NumberInput';
import { fire, get, mount, typeInto, unmount } from './dom';
import { Controlled } from './harness';

describe('NumberInput', () => {
    afterEach(unmount);

    const render = (initial: number) => {
        const onChange = vi.fn();
        mount(
            <Controlled initial={initial} onChange={onChange}>
                {(value, change) => (
                    <NumberInput
                        value={value}
                        onChange={change}
                        ariaLabel="Health"
                    />
                )}
            </Controlled>
        );
        return onChange;
    };

    const INPUT = 'input[aria-label="Health"]';
    const input = () => get<HTMLInputElement>(INPUT);

    it('keeps partial text while typing and reports only numbers', () => {
        const onChange = render(10);
        typeInto(input(), '-');
        expect(input().value).toBe('-');
        expect(input().getAttribute('aria-invalid')).toBe('true');
        expect(onChange).not.toHaveBeenCalled();

        typeInto(input(), '-1.');
        expect(input().value).toBe('-1.');
        expect(onChange).toHaveBeenLastCalledWith(-1);

        typeInto(input(), '-1.5');
        expect(onChange).toHaveBeenLastCalledWith(-1.5);
        expect(input().getAttribute('aria-invalid')).toBe('false');
    });

    it('restores the number when partial text loses focus', () => {
        render(10);
        typeInto(input(), '1e');
        fire(input(), new FocusEvent('focusout', { bubbles: true }));
        expect(input().value).toBe('10');
    });
});
