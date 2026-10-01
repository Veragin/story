import '@story/shared'; // installs the global `_`
import { $, typeInto } from './dom';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TFunctionDto } from '@story/visualizer-protocol';
import { FunctionInput } from '../FunctionInput';

describe('FunctionInput', () => {
    let root: Root | null = null;

    afterEach(() => {
        act(() => root?.unmount());
        root = null;
        document.body.innerHTML = '';
    });

    const render = (
        initial: TFunctionDto | undefined,
        props: { optional?: boolean; emptyCode?: string } = {}
    ) => {
        const onChange = vi.fn();
        const Harness = () => {
            const [value, setValue] = useState(initial);
            return (
                <FunctionInput
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
        const container = document.body.appendChild(
            document.createElement('div')
        );
        root = createRoot(container);
        act(() => root!.render(<Harness />));
        return onChange;
    };

    const code = () =>
        $<HTMLTextAreaElement>('textarea[aria-label="Execute code"]');
    const description = () =>
        $<HTMLTextAreaElement>('[data-field="function-description"]');
    const click = (selector: string) => act(() => $(selector)!.click());

    it('starts in the code view without a description', () => {
        render({ code: '() => {}' });
        expect(code()!.value).toBe('() => {}');
        expect(description()).toBeNull();
        expect(
            $('[data-action="show-description"]')!.getAttribute('data-empty')
        ).toBe('true');
    });

    it('starts in the description view when there is one (D7)', () => {
        render({ code: '() => heal()', description: 'Heals Annie.' });
        expect(description()!.value).toBe('Heals Annie.');
        expect(code()).toBeNull();
        expect(
            $('[data-action="show-code"]')!.getAttribute('data-empty')
        ).toBeNull();
    });

    it('keeps both values while toggling between the views', () => {
        const onChange = render({ code: '() => {}' });
        typeInto(code()!, '() => heal()');
        click('[data-action="show-description"]');
        typeInto(description()!, 'Heals Annie.');
        expect(onChange).toHaveBeenLastCalledWith({
            code: '() => heal()',
            description: 'Heals Annie.',
        });

        click('[data-action="show-code"]');
        expect(code()!.value).toBe('() => heal()');
        click('[data-action="show-description"]');
        expect(description()!.value).toBe('Heals Annie.');
    });

    it('drops the description key when it is cleared', () => {
        const onChange = render({ code: 'true', description: 'Always.' });
        typeInto(description()!, '');
        expect(onChange).toHaveBeenLastCalledWith({ code: 'true' });
        expect(Object.keys(onChange.mock.lastCall![0] as object)).toEqual([
            'code',
        ]);
    });

    it('marks a description-only stub as having no code', () => {
        render({ code: '', description: 'To do.' });
        expect($('[data-action="show-code"]')!.getAttribute('data-empty')).toBe(
            'true'
        );
    });

    it('adds an optional value with the empty code and removes it again', () => {
        const onChange = render(undefined, {
            optional: true,
            emptyCode: '() => {}',
        });
        expect(code()).toBeNull();
        click('[data-action="add-function"]');
        expect(onChange).toHaveBeenLastCalledWith({ code: '() => {}' });
        expect(code()!.value).toBe('() => {}');

        click('[data-action="remove-function"]');
        expect(onChange).toHaveBeenLastCalledWith(undefined);
        expect(code()).toBeNull();
        expect($('[data-action="add-function"]')).not.toBeNull();
    });

    it('has no add or remove button when not optional', () => {
        render({ code: 'true' });
        expect($('[data-action="remove-function"]')).toBeNull();
        expect($('[data-action="add-function"]')).toBeNull();
    });

    it('shows the diagnostics in the description view too', () => {
        const onChange = vi.fn();
        const container = document.body.appendChild(
            document.createElement('div')
        );
        root = createRoot(container);
        act(() =>
            root!.render(
                <FunctionInput
                    label="Execute"
                    value={{ code: '() => x', description: 'Uses x.' }}
                    onChange={onChange}
                    diagnostics={[
                        {
                            file: 'forest.ts',
                            line: 3,
                            column: 5,
                            message: "Cannot find name 'x'.",
                        },
                    ]}
                />
            )
        );
        expect(description()).not.toBeNull();
        expect(document.body.textContent).toContain("Cannot find name 'x'.");
    });
});
