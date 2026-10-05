// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TLocationDto } from '@story/visualizer-protocol';
import { InStructure } from '../../../components/inputs/__tests__/harness';
import {
    $$,
    click,
    flush,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { LocationForm } from '../LocationForm/LocationForm';
import type { TLocationPatch } from '../LocationForm/draft';

const DTO: TLocationDto = {
    kind: 'locations',
    id: 'kingdom',
    version: 'v1',
    file: 'data/locations/kingdom.location.ts',
    name: { code: "_('kingdom')" },
    description: 'Big',
    localCharacters: [{ name: 'Pepa', description: 'Baker' }],
    init: {},
};

describe('LocationForm', () => {
    afterEach(unmount);

    const mountForm = async (readOnly = false) => {
        const onSave = vi.fn((_patch: TLocationPatch, version: string) =>
            Promise.resolve({ ...DTO, version: `${version}+` })
        );
        await mountAsync(
            <InStructure>
                <LocationForm
                    location={DTO}
                    readOnly={readOnly}
                    onSave={onSave}
                />
            </InStructure>
        );
        return onSave;
    };

    it('edits the description and the local characters and saves only those', async () => {
        const onSave = await mountForm();
        expect(
            get('[data-form-field="Name"] [data-code-value]').textContent
        ).toBe("_('kingdom')");
        typeInto(
            get<HTMLTextAreaElement>('textarea[data-field="description"]'),
            'Bigger'
        );
        click('[data-form-field="Local characters"] [data-action="add-item"]');
        const names = $$<HTMLInputElement>(
            '[data-form-field="Local characters"] [data-form-field="name"] input'
        );
        typeInto(names[1], 'Jan');
        click('button[type="submit"]');
        await flush();
        expect(onSave).toHaveBeenCalledWith(
            {
                description: 'Bigger',
                localCharacters: [
                    { name: 'Pepa', description: 'Baker' },
                    { name: 'Jan', description: '' },
                ],
            },
            'v1'
        );
    });

    it('disables the inputs when read-only', async () => {
        await mountForm(true);
        expect(
            get<HTMLTextAreaElement>('textarea[data-field="description"]')
                .disabled
        ).toBe(true);
        expect($$('button[type="submit"]')).toHaveLength(0);
    });
});
