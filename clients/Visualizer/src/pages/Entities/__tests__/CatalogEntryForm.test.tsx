import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StructureContext } from '../../../structure/structureContext';
import {
    click,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import {
    createMockStores,
    settle,
    type TMockStores,
} from '../../../stores/__tests__/mockStores';
import { CatalogEntryForm } from '../CatalogEntryForm';
import { CatalogFormStore } from '../CatalogFormStore';

describe('CatalogEntryForm', () => {
    let stores: TMockStores;
    let store: CatalogFormStore;

    beforeEach(async () => {
        stores = createMockStores();
        store = new CatalogFormStore({
            entities: stores.entities,
            events: stores.events,
        });
        store.start();
        await act(async () => {
            await settle();
            await store.show('races', 'elf');
        });
        await mountAsync(
            <StructureContext.Provider value={stores.structure}>
                <CatalogEntryForm
                    store={store}
                    type={stores.structure.type('Race')}
                />
            </StructureContext.Provider>
        );
    });

    afterEach(() => {
        unmount();
        store.dispose();
        stores.release();
    });

    it('edits the entry as the fields of its type and saves', async () => {
        expect(get('h2').textContent).toBe('Elf');
        typeInto(
            get<HTMLInputElement>('[data-form-field="strength"] input'),
            '7'
        );
        await act(async () => {
            click('[data-action="save"]');
            await settle();
        });
        expect(
            (await stores.api.getCatalogEntry('races', 'elf')).values
        ).toEqual({ name: 'Elf', strength: 7 });
    });

    it('links to its class and edits a struct field as a fixed-shape object', async () => {
        expect(get('a[href="#/structure/classes/Race"]').textContent).toBe(
            'Race'
        );
        const race = stores.structure.type('Race');
        await act(async () => {
            await stores.structure.updateType('Race', {
                version: race?.version ?? '',
                fields: [
                    ...(race?.fields ?? []),
                    {
                        key: 'stats',
                        type: { t: 'struct', name: 'TStats' },
                        optional: false,
                    },
                ],
            });
            await settle();
            await store.show('races', 'dwarf');
        });
        expect(
            (await stores.api.getCatalogEntry('races', 'dwarf')).values.stats
        ).toEqual({ strength: 0 });
        const stats = '[data-form-field="stats"]';
        expect(document.querySelector(`${stats} [data-add-field]`)).toBeNull();
        typeInto(
            get<HTMLInputElement>(`${stats} input[aria-label="strength"]`),
            '9'
        );
        await act(async () => {
            click('[data-action="save"]');
            await settle();
        });
        expect(
            (await stores.api.getCatalogEntry('races', 'dwarf')).values
        ).toEqual({ name: 'Dwarf', strength: 5, stats: { strength: 9 } });
    });

    it('shows the cleared notice after a delete', async () => {
        const { api } = stores;
        const character = (await api.getStructure()).types.find(
            (t) => t.name === 'Character'
        );
        await api.updateType('Character', {
            version: character?.version ?? '',
            fields: [
                {
                    key: 'race',
                    type: { t: 'ref', name: 'Race' },
                    optional: true,
                },
            ],
        });
        const thomas = await api.getEntity('characters', 'thomas');
        await api.updateEntity('characters', 'thomas', {
            version: thomas.version,
            userFields: { race: 'elf' },
        });
        await act(async () => {
            await store.remove();
        });
        expect(get('[data-notice="cleared"]').textContent).toBe(
            'Deleted. Values cleared: 1characters/thomas race: removed'
        );
    });
});
