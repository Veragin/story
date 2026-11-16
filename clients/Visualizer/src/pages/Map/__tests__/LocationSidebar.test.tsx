// @vitest-environment jsdom
import '@story/shared'; // installs the global `_`
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiEvents, createMockApi } from '../../../api';
import {
    $,
    click,
    get,
    mountAsync,
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
        onOpenMap: vi.fn(),
        onAddMap: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
    };

    const open = async (locationId: string) => {
        await mountAsync(
            <LocationSidebar
                store={store}
                locationId={locationId}
                {...handlers}
            />
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
        expect(get('h2').textContent).toBe('Village');
        expect(sidebar.textContent).toContain('location');
        expect(get('[data-copy="village"]')).toBeTruthy();
        expect(
            get('[data-copy="data/locations/village.location.ts"]')
        ).toBeTruthy();
        expect(sidebar.textContent).toContain('a few houses and a tavern');
        expect(sidebar.querySelector('dt')?.textContent).not.toBe('Id');
    });

    it('runs the actions from the icon toolbar', async () => {
        await open('village');
        click('[data-action="edit"]');
        click('[data-action="delete"]');
        expect(handlers.onEdit).toHaveBeenCalledWith('village');
        expect(handlers.onDelete).toHaveBeenCalledWith('village');
        const mapAction =
            $('[data-action="open-map"]') ?? get('[data-action="add-map"]');
        act(() => mapAction.click());
        expect(
            handlers.onOpenMap.mock.calls.length +
                handlers.onAddMap.mock.calls.length
        ).toBe(1);
        click('[data-action="close"]');
        expect(store.selectedLocationId).toBeNull();
    });
});
