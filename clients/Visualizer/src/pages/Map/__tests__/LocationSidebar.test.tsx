// @vitest-environment jsdom
import '@story/shared'; // installs the global `_`
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiEvents, createMockApi } from '../../../api';
import { InStructure } from '../../../components/inputs/__tests__/harness';
import {
    $,
    click,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { LocationSidebar } from '../LocationSidebar';
import { MapPageStore } from '../MapPageStore';

const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('LocationSidebar', () => {
    let store: MapPageStore;
    const handlers = {
        onAddMap: vi.fn(),
        onDelete: vi.fn(),
    };

    const open = async (locationId: string) => {
        await mountAsync(
            <InStructure>
                <LocationSidebar
                    store={store}
                    locationId={locationId}
                    {...handlers}
                />
            </InStructure>
        );
        await act(settle);
    };

    beforeEach(async () => {
        sessionStorage.clear();
        Object.values(handlers).forEach((fn) => fn.mockClear());
        const events = new ApiEvents({ createEventSource: undefined });
        store = new MapPageStore({
            api: createMockApi({ events }),
            events,
            confirm: () => Promise.resolve(true),
            persistUiState: false,
        });
        await store.init();
    });

    afterEach(unmount);

    it('shows the heading, badge, id and file, and the details without them', async () => {
        await open('village');
        const sidebar = get('[data-testid="location-sidebar"]');
        expect(get<HTMLInputElement>('input[data-field="name"]').value).toBe(
            'Village'
        );
        expect(sidebar.textContent).toContain('location');
        expect(get('[data-copy="village"]')).toBeTruthy();
        expect(
            get('[data-copy="data/locations/village.location.ts"]')
        ).toBeTruthy();
        expect(
            get<HTMLTextAreaElement>('textarea[data-field="description"]').value
        ).toContain('a few houses and a tavern');
        expect(sidebar.querySelector('dt')?.textContent).not.toBe('Id');
        expect($('[data-action="open-map"]')).toBeNull();
    });

    it('saves the edited description and discards the rest', async () => {
        await open('village');
        const save = vi.spyOn(store, 'saveLocation');
        typeInto(
            get<HTMLTextAreaElement>('textarea[data-field="description"]'),
            'A quiet village'
        );
        click('[data-action="save"]');
        await act(settle);
        expect(save).toHaveBeenCalledWith(
            'village',
            { description: 'A quiet village' },
            expect.any(String)
        );
        expect(store.locations.get('village')?.description).toBe(
            'A quiet village'
        );

        typeInto(get<HTMLInputElement>('input[data-field="name"]'), 'Town');
        click('[data-action="discard"]');
        expect(get<HTMLInputElement>('input[data-field="name"]').value).toBe(
            'Village'
        );
    });

    it('runs the actions from the icon toolbar', async () => {
        await open('village');
        click('[data-action="delete"]');
        expect(handlers.onDelete).toHaveBeenCalledWith('village');
        const addMap = $('[data-action="add-map"]');
        if (addMap) {
            act(() => addMap.click());
            expect(handlers.onAddMap).toHaveBeenCalledWith('village');
        }
        click('[data-action="close"]');
        expect(store.selectedLocationId).toBeNull();
    });
});
