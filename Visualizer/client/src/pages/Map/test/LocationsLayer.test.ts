import '@story/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiEvents, createMockApi } from '../../../api';
import { PolygonShape, Scene } from '../../../canvas';
import {
    createCanvas,
    doubleClick,
    drag,
    flushFrames,
    installFrames,
    uninstallFrames,
} from '../../../canvas/test/helpers';
import { LocationsLayer } from '../LocationsLayer';
import { MapPageStore } from '../MapPageStore';

const setup = async () => {
    const events = new ApiEvents({ createEventSource: undefined });
    const api = createMockApi({ events });
    const store = new MapPageStore({ api, events, persistUiState: false });
    await store.init();
    store.setViewport({ width: 800, height: 600 });
    store.camera.set({ x: 0, y: 0, zoom: 1 });
    const canvas = createCanvas(800, 600);
    const scene = new Scene(canvas, { camera: store.camera });
    const open = vi.fn();
    const layer = new LocationsLayer(scene, store, open);
    return { api, store, scene, layer, canvas, open };
};

beforeEach(() => installFrames());
afterEach(() => {
    uninstallFrames();
    document.body.innerHTML = '';
});

describe('LocationsLayer', () => {
    it('draws one polygon per location shape, labelled with the location name', async () => {
        const { layer } = await setup();
        const village = layer.getShape('village');
        expect(village).toBeInstanceOf(PolygonShape);
        expect(village?.label).toBe('Village');
        expect(layer.getShape('kingdom')?.label).toBe('kingdom');
    });

    it('follows the mode: view = read-only, locations = editable, tiles = hidden and click-through', async () => {
        const { store, scene } = await setup();
        expect(scene.editable).toBe(false);
        store.setMode('locations');
        expect(scene.editable).toBe(true);
        expect(scene.canvas.style.pointerEvents).toBe('auto');
        store.setMode('tiles');
        expect(scene.layer('locations').visible).toBe(false);
        expect(scene.canvas.style.pointerEvents).toBe('none');
        store.setMode('view');
        expect(scene.layer('locations').visible).toBe(true);
    });

    it('opens the modal on double-click, also in view mode', async () => {
        const { canvas, open } = await setup();
        doubleClick(canvas, 180, 250); // inside the village polygon (100..260 × 180..320)
        expect(open).toHaveBeenCalledWith('village');
    });

    it('selects, drags and writes the moved polygon back into the map (autosaved)', async () => {
        vi.useFakeTimers();
        try {
            const { store, canvas, layer, api } = await setup();
            store.setMode('locations');
            drag(canvas, [180, 250], [180, 250], 1); // a click: selects
            expect(store.selectedLocationId).toBe('village');
            drag(canvas, [180, 250], [230, 270]);
            expect(store.map?.locations.village.polygon[0]).toEqual({ x: 150, y: 200 });
            expect(store.saveStatus).toBe('pending');
            await vi.advanceTimersByTimeAsync(1000);
            expect((await api.getMap('global')).locations.village.polygon[0]).toEqual({ x: 150, y: 200 });
            expect(layer.selection.selected?.id).toBe('location:village');
        } finally {
            vi.useRealTimers();
        }
    });

    it('syncs added, recoloured and removed locations from the store', async () => {
        const { store, layer } = await setup();
        store.placeLocation('cave', { x: 500, y: 500 });
        expect(layer.getShape('cave')?.label).toMatch(/no location file/);
        store.setLocationColor('village', '#112233');
        flushFrames();
        expect(layer.getShape('village')?.fill).toBe('#11223359');
        expect(layer.getShape('village')?.stroke?.color).toBe('#112233');
        store.setMode('locations');
        store.selectLocation('village');
        expect(layer.selection.selected?.id).toBe('location:village');
        delete store.map!.locations.village;
        store.onMapEdited();
        expect(layer.getShape('village')).toBeUndefined();
        expect(layer.selection.selected).toBeNull();
    });
});
