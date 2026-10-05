import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TMaybeCode } from '@story/visualizer-protocol';
import { NumberInput } from '../NumberInput';
import { $, click, fire, get, mount, typeInto, unmount } from './dom';
import { Controlled } from './harness';

describe('NumberInput', () => {
    afterEach(unmount);

    const render = (initial: TMaybeCode<number>) => {
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

    it('shows code read-only and converts a plain number', () => {
        const onChange = render({ code: '42' });
        expect($(INPUT)).toBeNull();
        expect(document.body.textContent).toContain('42');
        click('[data-action="convert-to-value"]');
        expect(onChange).toHaveBeenLastCalledWith(42);
        expect(input().value).toBe('42');
    });

    it('offers reset for code that is not a number', () => {
        const onChange = render({ code: 's.health * 2' });
        expect($('[data-action="convert-to-value"]')).toBeNull();
        click('[data-action="reset-value"]');
        expect(onChange).toHaveBeenLastCalledWith(0);
    });
});
