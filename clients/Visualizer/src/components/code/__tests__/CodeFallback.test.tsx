import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TMaybeCode } from '@story/protocol';
import { $, click, get, mount, unmount } from '../../inputs/__tests__/dom';
import { Controlled } from '../../inputs/__tests__/harness';
import { CodeFallback } from '../CodeFallback';
import { MaybeCodeAutocompleteInput } from '../MaybeCodeAutocompleteInput';
import { MaybeCodeNumberInput } from '../MaybeCodeNumberInput';

const parseDigits = (code: string) =>
    /^\d+$/.test(code) ? Number(code) : undefined;

describe('CodeFallback', () => {
    afterEach(unmount);

    const render = (value: TMaybeCode<number>, fallback?: number) => {
        const onChange = vi.fn();
        mount(
            <CodeFallback
                value={value}
                onChange={onChange}
                parse={parseDigits}
                fallback={fallback}
                ariaLabel="Health"
            >
                {(plain) => <output data-plain>{plain}</output>}
            </CodeFallback>
        );
        return onChange;
    };

    it('renders the plain value through its children', () => {
        render(7);
        expect(get('[data-plain]').textContent).toBe('7');
        expect($('[data-code-value]')).toBeNull();
    });

    it('shows code read-only and converts it when it parses', () => {
        const onChange = render({ code: '42' });
        expect($('[data-plain]')).toBeNull();
        expect(get('[data-code-value]').textContent).toBe('42');
        click('[data-action="convert-to-value"]');
        expect(onChange).toHaveBeenCalledWith(42);
    });

    it('offers reset to the fallback when the code does not parse', () => {
        const onChange = render({ code: 's.health * 2' }, 0);
        expect($('[data-action="convert-to-value"]')).toBeNull();
        click('[data-action="reset-value"]');
        expect(onChange).toHaveBeenCalledWith(0);
    });

    it('has no reset without a fallback', () => {
        render({ code: 's.health * 2' });
        expect($('[data-action="reset-value"]')).toBeNull();
    });
});

describe('MaybeCode wrappers', () => {
    afterEach(unmount);

    it('turns converted code into the pure number input', () => {
        const onChange = vi.fn();
        mount(
            <Controlled<TMaybeCode<number>>
                initial={{ code: '42' }}
                onChange={onChange}
            >
                {(value, change) => (
                    <MaybeCodeNumberInput
                        value={value}
                        onChange={change}
                        ariaLabel="Health"
                    />
                )}
            </Controlled>
        );
        expect($('input[aria-label="Health"]')).toBeNull();
        click('[data-action="convert-to-value"]');
        expect(onChange).toHaveBeenLastCalledWith(42);
        expect(get<HTMLInputElement>('input[aria-label="Health"]').value).toBe(
            '42'
        );
    });

    it('converts a string literal id for the autocomplete', () => {
        const onChange = vi.fn();
        mount(
            <MaybeCodeAutocompleteInput
                value={{ code: "'well'" }}
                onChange={onChange}
                options={[{ id: 'forest' }, { id: 'well' }]}
                ariaLabel="Place"
            />
        );
        click('[data-action="convert-to-value"]');
        expect(onChange).toHaveBeenCalledWith('well');
    });
});
