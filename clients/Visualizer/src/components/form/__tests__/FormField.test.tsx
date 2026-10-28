import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TInputProps } from '../../inputs/inputTypes';
import { createFormInput } from '../createFormInput';
import { FormTextInput } from '../FormTextInput';
import { $, click, get, mount, unmount } from '../../inputs/__tests__/dom';
import { Controlled } from '../../inputs/__tests__/harness';

describe('FormField', () => {
    afterEach(unmount);

    const render = (initial: string | undefined, optional?: boolean) => {
        const onChange = vi.fn();
        mount(
            <Controlled initial={initial} onChange={onChange}>
                {(value, change) => (
                    <FormTextInput
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

    it('marks the field invalid for an error without diagnostics', () => {
        mount(
            <FormTextInput
                label="Name"
                value="Annie"
                onChange={vi.fn()}
                error="Taken."
            />
        );
        const input = get<HTMLInputElement>('input[aria-label="Name"]');
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(get('[data-form-field="Name"]').textContent).toContain('Taken.');
    });
});

describe('createFormInput', () => {
    afterEach(unmount);

    const Probe = (props: TInputProps<string> & { hint: string }) => (
        <output data-probe={JSON.stringify(props)} />
    );
    const FormProbe = createFormInput(Probe, ({ hint }) => `empty ${hint}`);

    const probed = () =>
        JSON.parse(get('[data-probe]').getAttribute('data-probe') ?? '{}');

    it('passes the input its own props, the label as aria label and nothing of the label', () => {
        mount(
            <FormProbe
                label="Mood"
                value="calm"
                onChange={vi.fn()}
                hint="h"
                helperText="Help"
                dataField="mood"
                disabled
            />
        );
        expect(probed()).toEqual({
            value: 'calm',
            hint: 'h',
            ariaLabel: 'Mood',
            hasError: false,
            disabled: true,
            dataField: 'mood',
        });
    });

    it('fills a missing required value with the empty value from the props', () => {
        mount(
            <FormProbe
                label="Mood"
                value={undefined}
                onChange={vi.fn()}
                hint="h"
            />
        );
        expect(probed().value).toBe('empty h');
    });

    it('adds the empty value to a missing optional value', () => {
        const onChange = vi.fn();
        mount(
            <FormProbe
                label="Mood"
                value={undefined}
                onChange={onChange}
                hint="h"
                optional
            />
        );
        expect($('[data-probe]')).toBeNull();
        click('[data-action="add-field"]');
        expect(onChange).toHaveBeenCalledWith('empty h');
    });
});
