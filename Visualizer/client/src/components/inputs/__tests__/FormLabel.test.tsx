import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TMaybeCode } from '@story/visualizer-protocol';
import { FormStringInput } from '../form/FormStringInput';
import { $, click, get, mount, unmount } from './dom';
import { Controlled } from './harness';

describe('FormLabel', () => {
    afterEach(unmount);

    const render = (
        initial: TMaybeCode<string> | undefined,
        optional?: boolean
    ) => {
        const onChange = vi.fn();
        mount(
            <Controlled initial={initial} onChange={onChange}>
                {(value, change) => (
                    <FormStringInput
                        label="Description"
                        value={value}
                        onChange={change}
                        optional={optional}
                        helperText="Shown on hover"
                        diagnostics={[
                            {
                                file: 'a.ts',
                                line: 1,
                                column: 2,
                                message: 'Bad.',
                            },
                        ]}
                    />
                )}
            </Controlled>
        );
        return onChange;
    };

    const INPUT = 'input[aria-label="Description"]';

    it('shows "+ label" for a missing optional value and adds the empty value', () => {
        const onChange = render(undefined, true);
        expect($(INPUT)).toBeNull();
        expect(get('[data-action="add-field"]').textContent).toBe(
            'Description'
        );
        expect(document.body.textContent).toContain('Bad.');

        click('[data-action="add-field"]');
        expect(onChange).toHaveBeenLastCalledWith('');
        expect(get<HTMLInputElement>(INPUT).value).toBe('');
    });

    it('removes a set optional value', () => {
        const onChange = render('Annie', true);
        click('[data-action="remove-field"]');
        expect(onChange).toHaveBeenLastCalledWith(undefined);
        expect($(INPUT)).toBeNull();
        expect($('[data-action="add-field"]')).not.toBeNull();
    });

    it('has no add or remove for a required value', () => {
        render(undefined);
        expect(get<HTMLInputElement>(INPUT).value).toBe('');
        expect($('[data-action="add-field"]')).toBeNull();
        expect($('[data-action="remove-field"]')).toBeNull();
    });

    it('shows the label, helper text and diagnostics', () => {
        render('Annie');
        const field = get('[data-form-field="Description"]');
        expect(field.textContent).toContain('Description');
        expect(field.textContent).toContain('Shown on hover');
        expect(field.textContent).toContain('Bad. (a.ts:1:2)');
        expect(get<HTMLInputElement>(INPUT).getAttribute('aria-invalid')).toBe(
            'true'
        );
    });
});
