import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
    TFieldDesc,
    TMaybeCode,
    TValueRecord,
} from '@story/visualizer-protocol';
import { ObjectInput } from '../ObjectInput/ObjectInput';
import { $, click, get, mount, selectOption, typeInto, unmount } from './dom';
import { Controlled, InStructure } from './harness';

const FIELDS: TFieldDesc[] = [
    { key: 'health', type: { t: 'number' }, optional: false },
    {
        key: 'location',
        type: { t: 'ref', name: 'TLocation' },
        optional: false,
        locked: true,
    },
    { key: 'mood', type: { t: 'literal', name: 'TMood' }, optional: true },
];

describe('ObjectInput', () => {
    afterEach(unmount);

    const render = (
        initial: TMaybeCode<TValueRecord>,
        fields?: TFieldDesc[],
        allowCustomFields?: boolean
    ) => {
        const onChange = vi.fn();
        mount(
            <InStructure>
                <Controlled initial={initial} onChange={onChange}>
                    {(value, change) => (
                        <ObjectInput
                            value={value}
                            onChange={change}
                            fields={fields}
                            allowCustomFields={allowCustomFields}
                            ariaLabel="Init"
                        />
                    )}
                </Controlled>
            </InStructure>
        );
        return onChange;
    };

    const CODE = 'textarea[aria-label="Init code"]';
    const showInputs = () =>
        get<HTMLButtonElement>('[data-action="show-inputs"]');

    it('round-trips inputs → code → inputs without losing the values', () => {
        const initial = { health: 10, location: 'forest' };
        const onChange = render(initial, FIELDS);
        expect(get<HTMLInputElement>('input[aria-label="health"]').value).toBe(
            '10'
        );

        click('[data-action="show-code"]');
        expect(onChange).toHaveBeenLastCalledWith({
            code: "{ health: 10, location: 'forest' }",
        });
        expect(get<HTMLTextAreaElement>(CODE).value).toBe(
            "{ health: 10, location: 'forest' }"
        );

        click('[data-action="show-inputs"]');
        expect(onChange).toHaveBeenLastCalledWith(initial);
    });

    it('parses edited code back into inputs', () => {
        const onChange = render({ code: '{ health: 1 }' }, FIELDS);
        typeInto(
            get<HTMLTextAreaElement>(CODE),
            "{ health: 3, location: 'village' }"
        );
        click('[data-action="show-inputs"]');
        expect(onChange).toHaveBeenLastCalledWith({
            health: 3,
            location: 'village',
        });
    });

    it('blocks the inputs view for code that does not parse', () => {
        render({ code: '{ health: 1' }, FIELDS);
        expect(showInputs().disabled).toBe(true);
        expect(document.body.textContent).toContain('Missing }');
    });

    it('validates code against the fields', () => {
        render({ code: "{ health: 'x', mood: 'sad', energy: 1 }" }, FIELDS);
        const text = document.body.textContent ?? '';
        expect(text).toContain('location: Missing required field');
        expect(text).toContain('energy: Unknown field');
        expect(text).toContain('health: Expected a number');
        expect(text).toContain("mood: 'sad' is not in TMood");
        expect(showInputs().disabled).toBe(false);
    });

    it('adds a missing optional field from its chip and removes it again', () => {
        const onChange = render({ health: 1, location: 'forest' }, FIELDS);
        expect($('[data-form-field="mood"]')).toBeNull();
        click('[data-action="add-optional-field"][data-key="mood"]');
        expect(onChange).toHaveBeenLastCalledWith({
            health: 1,
            location: 'forest',
            mood: 'calm',
        });
        click('[data-form-field="mood"] [data-action="remove-field"]');
        expect(onChange).toHaveBeenLastCalledWith({
            health: 1,
            location: 'forest',
        });
    });

    it('cannot remove a locked or required field', () => {
        render({ health: 1, location: 'forest' }, FIELDS);
        expect(
            $('[data-form-field="location"] [data-action="remove-field"]')
        ).toBeNull();
        expect(
            $('[data-form-field="health"] [data-action="remove-field"]')
        ).toBeNull();
    });

    it('warns about a key the fields do not declare, and removes it', () => {
        const onChange = render(
            { health: 1, location: 'forest', energy: 2 },
            FIELDS
        );
        expect(get('[data-form-field="energy"]').textContent).toContain(
            'Not a field of this type'
        );
        click('[data-form-field="energy"] [data-action="remove-field"]');
        expect(onChange).toHaveBeenLastCalledWith({
            health: 1,
            location: 'forest',
        });
        expect($('[data-add-field]')).toBeNull();
    });

    it('adds a custom field with a picked type', () => {
        const onChange = render({ name: 'Axe' });
        expect(get<HTMLInputElement>('input[aria-label="name"]').value).toBe(
            'Axe'
        );
        const key = get<HTMLInputElement>('input[aria-label="New field name"]');
        typeInto(key, 'name');
        expect(document.body.textContent).toContain('Already there');
        typeInto(key, '2x');
        expect(document.body.textContent).toContain('Not an identifier');

        typeInto(key, 'damage');
        selectOption(
            get<HTMLSelectElement>('select[aria-label="New field type"]'),
            'number'
        );
        click('[data-action="add-custom-field"]');
        expect(onChange).toHaveBeenLastCalledWith({ name: 'Axe', damage: 0 });
        expect(get<HTMLInputElement>('input[aria-label="damage"]').value).toBe(
            '0'
        );
    });
});
