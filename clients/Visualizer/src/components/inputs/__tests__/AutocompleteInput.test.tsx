import '@story/shared'; // installs the global `_`
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { optionsOf } from '../../../structure/option';
import { AutocompleteInput } from '../AutocompleteInput';
import { $, $$, click, flush, get, mount, typeInto, unmount } from './dom';
import { Controlled } from './harness';

const INPUT = 'input[aria-label="Type"]';
const input = () => get<HTMLInputElement>(INPUT);
const shownOptions = () =>
    $$('[data-option]').map((li) => li.getAttribute('data-option'));

describe('AutocompleteInput', () => {
    afterEach(unmount);

    const render = (
        initial: string,
        onCreateOption?: (value: string) => Promise<boolean>
    ) => {
        const onChange = vi.fn();
        mount(
            <Controlled initial={initial} onChange={onChange}>
                {(value, change) => (
                    <AutocompleteInput
                        value={value}
                        onChange={change}
                        options={optionsOf(['value', 'tool', 'food'])}
                        onCreateOption={onCreateOption}
                        ariaLabel="Type"
                    />
                )}
            </Controlled>
        );
        return onChange;
    };

    it('lists the options and picks one', () => {
        const onChange = render('tool');
        expect(input().value).toBe('tool');
        typeInto(input(), 'fo');
        expect(shownOptions()).toEqual(['food']);
        click('[data-option="food"]');
        expect(onChange).toHaveBeenLastCalledWith('food');
        expect(input().value).toBe('food');
    });

    it('shows a value outside the options as an error, not as an option', () => {
        render('weapon');
        expect(input().value).toBe('weapon');
        expect(input().getAttribute('aria-invalid')).toBe('true');
        expect(document.body.textContent).toContain('Not one of the options');
    });

    it('offers "+ Add" only with onCreateOption and only for a new value', () => {
        render('tool');
        typeInto(input(), 'weapon');
        expect($('[data-create]')).toBeNull();
        unmount();

        render(
            'tool',
            vi.fn(() => Promise.resolve(true))
        );
        typeInto(input(), 'food');
        expect($('[data-create]')).toBeNull();
        typeInto(input(), 'Food');
        expect(get('[data-create]').textContent).toBe('+ Add Food');
        typeInto(input(), '   ');
        expect($('[data-create]')).toBeNull();
    });

    it('sets a created value', async () => {
        const create = vi.fn(() => Promise.resolve(true));
        const onChange = render('tool', create);
        typeInto(input(), 'weapon');
        click('[data-create]');
        await flush();
        expect(create).toHaveBeenCalledWith('weapon');
        expect(onChange).toHaveBeenLastCalledWith('weapon');
    });

    it('keeps the old value when the create is refused', async () => {
        const create = vi.fn(() => Promise.resolve(false));
        const onChange = render('tool', create);
        typeInto(input(), 'weapon');
        click('[data-create]');
        await flush();
        expect(create).toHaveBeenCalledWith('weapon');
        expect(onChange).not.toHaveBeenCalled();
        act(() => input().blur());
        expect(input().value).toBe('tool');
    });
});

describe('AutocompleteInput with labels', () => {
    afterEach(unmount);

    const OPTIONS = [{ id: 'forest', label: 'Forest' }, { id: 'well' }];

    it('shows the name and picks an id', () => {
        const onChange = vi.fn();
        mount(
            <Controlled initial="forest" onChange={onChange}>
                {(value, change) => (
                    <AutocompleteInput
                        value={value}
                        onChange={change}
                        options={OPTIONS}
                        ariaLabel="Type"
                    />
                )}
            </Controlled>
        );
        expect(input().value).toBe('Forest');
        typeInto(input(), 'we');
        expect(shownOptions()).toEqual(['well']);
        click('[data-option="well"]');
        expect(onChange).toHaveBeenLastCalledWith('well');
        expect($('[data-create]')).toBeNull();
    });

    it('marks an unknown id', () => {
        mount(
            <AutocompleteInput
                value="moon"
                onChange={vi.fn()}
                options={OPTIONS}
                ariaLabel="Type"
            />
        );
        expect(input().value).toBe('moon');
        expect(input().getAttribute('aria-invalid')).toBe('true');
    });
});

describe('AutocompleteInput freeSolo', () => {
    afterEach(unmount);

    it('reports typed text that is not an option', () => {
        const onChange = vi.fn();
        mount(
            <Controlled initial="" onChange={onChange}>
                {(value, change) => (
                    <AutocompleteInput
                        freeSolo
                        value={value}
                        onChange={change}
                        options={optionsOf(['data/a.ts', 'data/b.ts'])}
                        ariaLabel="Type"
                    />
                )}
            </Controlled>
        );
        typeInto(input(), 'types/new.ts');
        expect(onChange).toHaveBeenLastCalledWith('types/new.ts');
        expect(input().getAttribute('aria-invalid')).toBe('false');
        expect(document.body.textContent).not.toContain(
            'Not one of the options'
        );
    });
});
