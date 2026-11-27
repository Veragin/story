import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it } from 'vitest';
import { TitleIdInput } from '../TitleIdInput';
import { useTitleId } from '../useTitleId';
import {
    $,
    click,
    get,
    mount,
    typeInto,
    unmount,
} from '../../inputs/__tests__/dom';

const TAKEN = new Set(['oldMill']);

const Harness = () => {
    const state = useTitleId('location', (id) => TAKEN.has(id));
    return (
        <>
            <TitleIdInput
                state={state}
                label="Name"
                idError={null}
                idPrefix="village_"
            />
            <output>{state.id}</output>
        </>
    );
};

const input = (field: string) =>
    get<HTMLInputElement>(`input[data-field="${field}"]`);

describe('TitleIdInput', () => {
    afterEach(unmount);

    it('generates a free id from the title and shows it', () => {
        mount(<Harness />);
        typeInto(input('title'), 'Old Mill');
        expect(get('output').textContent).toBe('oldMill2');
        expect(get('[data-form-field="Name"]').textContent).toContain(
            'village_oldMill2'
        );
        expect($('[data-field="id"]')).toBeNull();
    });

    it('lets the author override the id and go back to the generated one', () => {
        mount(<Harness />);
        typeInto(input('title'), 'Příběh');
        click('[data-action="edit-id"]');
        expect(input('id').value).toBe('pribeh');
        typeInto(input('id'), 'tale');
        expect(get('output').textContent).toBe('tale');
        click('[data-action="generate-id"]');
        expect(get('output').textContent).toBe('pribeh');
        expect($('[data-field="id"]')).toBeNull();
    });
});
