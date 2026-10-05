import '@story/shared'; // installs the global `_`
import { $, click, get, mount, typeInto, unmount } from './dom';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TFunctionDto } from '@story/visualizer-protocol';
import { FormFunctionInput } from '../form/FormFunctionInput';

describe('FunctionInput (through FormFunctionInput)', () => {
    afterEach(unmount);

    const render = (
        initial: TFunctionDto | undefined,
        props: { optional?: boolean; emptyCode?: string } = {}
    ) => {
        const onChange = vi.fn();
        const Harness = () => {
            const [value, setValue] = useState(initial);
            return (
                <FormFunctionInput
                    label="Execute"
                    value={value}
                    onChange={(next) => {
                        onChange(next);
                        setValue(next);
                    }}
                    {...props}
                />
            );
        };
        mount(<Harness />);
        return onChange;
    };

    const CODE = 'textarea[aria-label="Execute code"]';
    const DESCRIPTION = '[data-field="function-description"]';
    const code = () => $<HTMLTextAreaElement>(CODE);
    const description = () => $<HTMLTextAreaElement>(DESCRIPTION);

    it('starts in the code view without a description', () => {
        render({ code: '() => {}' });
        expect(get<HTMLTextAreaElement>(CODE).value).toBe('() => {}');
        expect(description()).toBeNull();
        expect(
            get('[data-action="show-description"]').getAttribute('data-empty')
        ).toBe('true');
    });

    it('starts in the description view when there is one (D7)', () => {
        render({ code: '() => heal()', description: 'Heals Annie.' });
        expect(get<HTMLTextAreaElement>(DESCRIPTION).value).toBe(
            'Heals Annie.'
        );
        expect(code()).toBeNull();
        expect(
            get('[data-action="show-code"]').getAttribute('data-empty')
        ).toBeNull();
    });

    it('keeps both values while toggling between the views', () => {
        const onChange = render({ code: '() => {}' });
        typeInto(get<HTMLTextAreaElement>(CODE), '() => heal()');
        click('[data-action="show-description"]');
        typeInto(get<HTMLTextAreaElement>(DESCRIPTION), 'Heals Annie.');
        expect(onChange).toHaveBeenLastCalledWith({
            code: '() => heal()',
            description: 'Heals Annie.',
        });

        click('[data-action="show-code"]');
        expect(get<HTMLTextAreaElement>(CODE).value).toBe('() => heal()');
        click('[data-action="show-description"]');
        expect(get<HTMLTextAreaElement>(DESCRIPTION).value).toBe(
            'Heals Annie.'
        );
    });

    it('drops the description key when it is cleared', () => {
        const onChange = render({ code: 'true', description: 'Always.' });
        typeInto(get<HTMLTextAreaElement>(DESCRIPTION), '');
        expect(onChange).toHaveBeenLastCalledWith({ code: 'true' });
        expect(Object.keys(onChange.mock.lastCall?.[0] ?? {})).toEqual([
            'code',
        ]);
    });

    it('marks a description-only stub as having no code', () => {
        render({ code: '', description: 'To do.' });
        expect(
            get('[data-action="show-code"]').getAttribute('data-empty')
        ).toBe('true');
    });

    it('adds an optional value with the empty code and removes it again', () => {
        const onChange = render(undefined, {
            optional: true,
            emptyCode: '() => {}',
        });
        expect(code()).toBeNull();
        click('[data-action="add-field"]');
        expect(onChange).toHaveBeenLastCalledWith({ code: '() => {}' });
        expect(get<HTMLTextAreaElement>(CODE).value).toBe('() => {}');

        click('[data-action="remove-field"]');
        expect(onChange).toHaveBeenLastCalledWith(undefined);
        expect(code()).toBeNull();
        expect($('[data-action="add-field"]')).not.toBeNull();
    });

    it('has no add or remove button when not optional', () => {
        render({ code: 'true' });
        expect($('[data-action="remove-field"]')).toBeNull();
        expect($('[data-action="add-field"]')).toBeNull();
    });

    it('shows the diagnostics in the description view too', () => {
        mount(
            <FormFunctionInput
                label="Execute"
                value={{ code: '() => x', description: 'Uses x.' }}
                onChange={vi.fn()}
                diagnostics={[
                    {
                        file: 'forest.ts',
                        line: 3,
                        column: 5,
                        message: "Cannot find name 'x'.",
                    },
                ]}
            />
        );
        expect(description()).not.toBeNull();
        expect(document.body.textContent).toContain("Cannot find name 'x'.");
    });
});
