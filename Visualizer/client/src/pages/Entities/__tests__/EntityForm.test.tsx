// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TCharacterDto } from '@story/visualizer-protocol';
import {
    ApiEvents,
    createMockApi,
    createMockSeed,
    type TMockApi,
} from '../../../api';
import { StructureContext } from '../../../components/inputs/structureContext';
import {
    $,
    $$,
    click,
    flush,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { EntityStore } from '../../../stores/EntityStore';
import { StructureStore } from '../../../stores/StructureStore';
import { EntityForm } from '../EntityForm';
import { EntityFormStore } from '../EntityFormStore';

const seedWithUserFields = () => {
    const seed = createMockSeed();
    const character = seed.structure.types.find(
        (type) => type.name === 'TCharacter'
    );
    character?.fields.push(
        { key: 'energy', type: { t: 'number' }, optional: false },
        { key: 'nickname', type: { t: 'string' }, optional: true }
    );
    seed.characters = seed.characters.map((c) => ({
        ...c,
        userFields: { energy: 5 },
    }));
    return seed;
};

describe('EntityForm', () => {
    let api: TMockApi;
    let entities: EntityStore;
    let structure: StructureStore;
    let store: EntityFormStore;
    let release: () => void;

    beforeEach(async () => {
        sessionStorage.clear();
        const events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events, seed: seedWithUserFields() });
        entities = new EntityStore({ api, events });
        structure = new StructureStore({ api, events, entities });
        store = new EntityFormStore({ entities, events, persist: false });
        const releaseStructure = structure.start();
        const dispose = store.start();
        release = () => {
            dispose();
            releaseStructure();
        };
        await act(() => store.show('characters', 'thomas'));
        await act(() => structure.load());
        await mountAsync(
            <StructureContext.Provider value={structure}>
                <EntityForm store={store} structure={structure} />
            </StructureContext.Provider>
        );
    });

    afterEach(() => {
        unmount();
        release();
    });

    it('renders the user fields of TCharacter and the init fields of TCharacterData + the data type', () => {
        const labels = $$('[data-form-field]').map(
            (el) => el.dataset.formField
        );
        expect(labels).toEqual(
            expect.arrayContaining([
                'name',
                'startPassageId',
                'energy',
                'nickname',
                'init',
                'health',
                'inventory',
            ])
        );
        expect(
            get('[data-form-field="init"] [data-key="knowsMagic"]')
        ).toBeTruthy();
    });

    it('saves a user field and removes an optional one with null', async () => {
        typeInto(
            get<HTMLInputElement>('[data-form-field="energy"] input'),
            '7'
        );
        click('[data-form-field="nickname"] [data-action="add-field"]');
        typeInto(
            get<HTMLInputElement>('[data-form-field="nickname"] input'),
            'Tom'
        );
        expect(store.changes).toEqual({
            userFields: { energy: 7, nickname: 'Tom' },
        });
        await act(() => store.save());
        let saved = (await api.getEntity(
            'characters',
            'thomas'
        )) as TCharacterDto;
        expect(saved.userFields).toEqual({ energy: 7, nickname: 'Tom' });

        click('[data-form-field="nickname"] [data-action="remove-field"]');
        expect(store.changes).toEqual({
            userFields: { energy: 7, nickname: null },
        });
        await act(() => store.save());
        saved = (await api.getEntity('characters', 'thomas')) as TCharacterDto;
        expect(saved.userFields).toEqual({ energy: 7 });
    });

    it('edits the data type as a structure and the init fields follow it', async () => {
        click(
            '[data-form-section="dataType"] [data-action="add-structure-field"]'
        );
        const dataType = (store.draft as TCharacterDto).dataType;
        expect(dataType?.fields?.map((f) => f.key)).toEqual([
            'knowsMagic',
            'field',
        ]);
        expect(dataType?.code).toBe('{ knowsMagic: boolean; field: string }');
        await flush();
        expect($('[data-form-field="init"] [data-key="field"]')).toBeTruthy();
    });
});
