import '@story/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ApiEvents, createMockApi, createMockSeed, type TMockApi } from '../../../api';
import { MapPageStore } from '../MapPageStore';
import { getUiState } from '../../../ui-state';

type TSetup = { api: TMockApi; events: ApiEvents; store: MapPageStore; confirm: ReturnType<typeof vi.fn> };

const setup = async (opts: { emptyMap?: boolean; persist?: boolean } = {}): Promise<TSetup> => {
    const events = new ApiEvents({ createEventSource: undefined });
    const seed = createMockSeed();
    if (opts.emptyMap) seed.maps = [];
    const api = createMockApi({ seed, events });
    const confirm = vi.fn(() => Promise.resolve(true));
    const store = new MapPageStore({ api, events, confirm, persistUiState: opts.persist ?? false });
    await store.init();
    return { api, events, store, confirm };
};

// lets the mock's promises and `setTimeout(0)` events run under fake timers
const settle = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('MapPageStore — loading', () => {
    it('loads the map with its version and the location entities', async () => {
        const { store } = await setup();
        expect(store.loadState).toBe('ready');
        expect(store.map?.mapId).toBe('global');
        expect(store.version).not.toBe('');
        expect(store.map?.data).toHaveLength(store.map!.height);
        expect(store.map?.data[0]).toHaveLength(store.map!.width);
        expect([...store.locations.keys()].sort()).toEqual(['kingdom', 'village']);
        expect(store.locationName('kingdom')).toBe('kingdom');
        expect(store.saveStatus).toBe('idle');
    });

    it("starts from an empty map of the story's mapSize (rows × columns, not transposed) when there is no map.json, and creates it on the first edit", async () => {
        const { api, store } = await setup({ emptyMap: true });
        const { width, height } = (await api.getStoryInfo()).mapSize;
        expect(width).not.toBe(height);
        expect(store.loadState).toBe('ready');
        expect(store.version).toBe('');
        expect(store.map?.width).toBe(width);
        expect(store.map?.height).toBe(height);
        expect(store.map?.data).toHaveLength(height);
        expect(store.map?.data[0]).toHaveLength(width);
        await expect(api.getMap('global')).rejects.toBeInstanceOf(ApiError);

        store.tiles.setSelectedColorId('grass');
        store.tiles.paint({ i: 2, j: 3 });
        await settle(1000);
        const saved = await api.getMap('global');
        expect(saved.data[2][3].tile).toBe('grass');
        expect(store.version).toBe(saved.version);
        expect(store.saveStatus).toBe('saved');
    });

    it('reports a load error (e.g. the server route answering 501)', async () => {
        const events = new ApiEvents({ createEventSource: undefined });
        const api = createMockApi({ events });
        vi.spyOn(api, 'getMap').mockRejectedValue(new ApiError(501, { error: 'not_implemented' as never }));
        const store = new MapPageStore({ api, events, persistUiState: false });
        await store.init();
        expect(store.loadState).toBe('error');
        expect(store.loadError).toMatch(/does not implement/);
    });
});

describe('MapPageStore — autosave', () => {
    it('saves once, about 1 s after the last change', async () => {
        const { api, store } = await setup();
        const update = vi.spyOn(api, 'updateMap');
        store.tiles.setSelectedColorId('water');
        store.tiles.paint({ i: 4, j: 4 });
        expect(store.saveStatus).toBe('pending');
        await settle(600);
        store.tiles.setTileText({ i: 4, j: 4 }, { label: 'Lake', description: 'Deep and cold.' });
        await settle(600);
        expect(update).not.toHaveBeenCalled();
        await settle(400);
        expect(update).toHaveBeenCalledTimes(1);
        await settle();
        expect(store.saveStatus).toBe('saved');

        const saved = await api.getMap('global');
        expect(saved.data[4][4]).toEqual({ tile: 'water', label: 'Lake', description: 'Deep and cold.' });
        expect(update.mock.calls[0][1].version).not.toBe(saved.version);
        expect(store.version).toBe(saved.version);
    });

    it('sends the version it is based on and keeps tracking it across saves', async () => {
        const { api, store } = await setup();
        const update = vi.spyOn(api, 'updateMap');
        const v0 = store.version;
        store.tiles.paint({ i: 3, j: 3 });
        await settle(1000);
        const v1 = store.version;
        store.tiles.setTileText({ i: 3, j: 3 }, { label: 'x' });
        await settle(1000);
        expect(update.mock.calls.map((c) => c[1].version)).toEqual([v0, v1]);
        expect(store.version).not.toBe(v1);
    });

    it('shows an error and retries on demand', async () => {
        const { api, store } = await setup();
        const update = vi.spyOn(api, 'updateMap').mockRejectedValueOnce(new Error('disk full'));
        store.tiles.paint({ i: 3, j: 3 });
        await settle(1000);
        expect(store.saveStatus).toBe('error');
        expect(store.saveError).toBe('disk full');
        await store.retrySave();
        expect(update).toHaveBeenCalledTimes(2);
        expect(store.saveStatus).toBe('saved');
    });

    it('merges on 409 stale: keeps both the other writer’s and the local edits', async () => {
        const { api, store } = await setup();
        // another writer changes a different tile and adds a colour
        const remote = await api.getMap('global');
        remote.data[0][0] = { tile: 'forest', label: 'Theirs' };
        remote.palette.ice = { name: 'Ice', color: '#ddeeff' };
        await api.updateMap('global', remote);

        store.tiles.setSelectedColorId('city');
        store.tiles.paint({ i: 5, j: 5 });
        await settle(1000);
        await settle();

        const saved = await api.getMap('global');
        expect(saved.data[0][0]).toEqual({ tile: 'forest', label: 'Theirs' });
        expect(saved.palette.ice).toBeDefined();
        expect(saved.data[5][5].tile).toBe('city');
        expect(store.saveStatus).toBe('saved');
        expect(store.version).toBe(saved.version);
        expect(store.notice?.kind).toBe('info');
    });

    it('saves pending edits when the page goes away', async () => {
        const { api, store } = await setup();
        store.tiles.paint({ i: 6, j: 6 });
        store.destroy();
        await settle();
        const saved = await api.getMap('global');
        expect(saved.data[6][6].tile).toBe(store.tiles.selectedColorId);
    });
});

describe('MapPageStore — live refresh', () => {
    it('refetches the map in place on an external change', async () => {
        const { api, store } = await setup();
        const map = store.map;
        const remote = await api.getMap('global');
        remote.data[1][1] = { tile: 'forest', description: 'Edited by hand' };
        await api.updateMap('global', remote); // (own-save echo: filtered)
        api.simulateExternalChange('map', 'global');
        await settle();
        expect(store.map).not.toBe(map);
        expect(store.map?.data[1][1].description).toBe('Edited by hand');
        expect(store.saveStatus).toBe('idle');
        expect(store.version).toBe((await api.getMap('global')).version);
    });

    it('merges an external change into unsaved edits and saves the result', async () => {
        const { api, store } = await setup();
        store.tiles.setSelectedColorId('city');
        store.tiles.paint({ i: 5, j: 5 });
        const remote = await api.getMap('global');
        remote.data[0][0] = { tile: 'forest' };
        await api.updateMap('global', remote);
        api.simulateExternalChange('map', 'global');
        await settle();
        expect(store.map?.data[0][0].tile).toBe('forest');
        expect(store.map?.data[5][5].tile).toBe('city');
        await settle(1000);
        const saved = await api.getMap('global');
        expect(saved.data[0][0].tile).toBe('forest');
        expect(saved.data[5][5].tile).toBe('city');
    });

    it('refetches a location entity when its file changes', async () => {
        const { api, store } = await setup();
        const before = store.locations.get('village')!.version;
        api.simulateExternalChange('entity', 'locations/village');
        await settle();
        expect(store.locations.get('village')!.version).not.toBe(before);
    });
});

describe('MapPageStore — modes and view state', () => {
    it('switches modes, hands pointer input to the tiles only in tiles mode, and remembers the mode', async () => {
        const { store } = await setup({ persist: true });
        expect(store.mode).toBe('view');
        expect(store.editable).toBe(false);
        expect(store.tiles.interactive).toBe(false);

        store.setMode('locations');
        store.selectLocation('village');
        expect(store.editable).toBe(true);
        expect(getUiState('map:mode', null)).toBe('locations');

        store.setMode('tiles');
        expect(store.tiles.interactive).toBe(true);
        expect(store.selectedLocationId).toBeNull();

        store.setMode('view');
        expect(store.tiles.interactive).toBe(false);
        store.camera.set({ x: 12, y: 34, zoom: 2 });
        store.destroy();

        const again = new MapPageStore({ api: store.api, persistUiState: true });
        expect(again.mode).toBe('view');
        expect(again.hasSavedCamera).toBe(true);
    });

    it('fits the map on first show, and an unmoved camera is not remembered (so a remount still fits)', async () => {
        const { store } = await setup({ persist: true });
        store.destroy();
        expect(getUiState('map:camera', null)).toBeNull();
        const next = new MapPageStore({ api: store.api, persistUiState: true });
        await next.init();
        next.setViewport({ width: 800, height: 600 });
        expect(next.camera.zoom).not.toBe(1);
        next.destroy();
    });

    it('keeps the camera in ui-state', async () => {
        const { store } = await setup({ persist: true });
        store.setViewport({ width: 800, height: 600 });
        store.camera.set({ x: 100, y: 50, zoom: 1.5 });
        await settle(300);
        expect(getUiState<{ zoom: number } | null>('map:camera', null)?.zoom).toBe(1.5);
        const next = new MapPageStore({ api: store.api, persistUiState: true });
        expect(next.camera.zoom).toBe(1.5);
        expect(next.hasSavedCamera).toBe(true);
    });
});

describe('MapPageStore — locations', () => {
    it('adds a location: creates the entity, then its shape in map.json, and selects it', async () => {
        const { api, store } = await setup();
        store.setViewport({ width: 800, height: 600 });
        store.setMode('locations');
        const create = vi.spyOn(api, 'createEntity');
        const update = vi.spyOn(api, 'updateMap');
        const dto = await store.addLocation({ id: 'forest', name: 'Dark forest' }, { x: 300, y: 200 });
        expect(dto.id).toBe('forest');
        expect(create.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
        expect((await api.getEntity('locations', 'forest')).name).toBe('Dark forest');
        const saved = await api.getMap('global');
        expect(saved.locations.forest.polygon.length).toBe(6);
        expect(saved.locations.forest.fill).toMatch(/^#[0-9a-f]{6}59$/i);
        expect(store.selectedLocationId).toBe('forest');
        expect(store.locations.has('forest')).toBe(true);
    });

    it('refuses ids that cannot be file names or already exist', async () => {
        const { store } = await setup();
        expect(store.validateLocationId('dark-forest')).toBeTruthy();
        expect(store.validateLocationId('Forest')).toBeTruthy();
        expect(store.validateLocationId('village')).toBeTruthy();
        expect(store.validateLocationId('darkForest')).toBeNull();
        await expect(store.addLocation({ id: 'dark forest', name: '' })).rejects.toThrow();
    });

    it('places an existing location that has no shape yet', async () => {
        const { api, store } = await setup();
        await api.createEntity('locations', { id: 'cave' });
        await store.loadLocations();
        expect(store.unplacedLocations.map((l) => l.id)).toEqual(['cave']);
        store.placeLocation('cave', { x: 0, y: 0 });
        expect(store.unplacedLocations).toEqual([]);
        await settle(1000);
        expect((await api.getMap('global')).locations.cave).toBeDefined();
    });

    it('deletes a location after confirmation, entity first, then its shape', async () => {
        const { api, store, confirm } = await setup();
        confirm.mockResolvedValueOnce(false);
        expect(await store.deleteLocation('village')).toBe('cancelled');
        expect(store.locations.has('village')).toBe(true);

        expect(await store.deleteLocation('village')).toBe('deleted');
        expect(confirm).toHaveBeenCalledTimes(2);
        await expect(api.getEntity('locations', 'village')).rejects.toBeInstanceOf(ApiError);
        expect((await api.getMap('global')).locations.village).toBeUndefined();
        expect(store.locations.has('village')).toBe(false);
    });

    it('keeps the location and lists the references on 409 referenced', async () => {
        const { api, store } = await setup();
        vi.spyOn(api, 'deleteEntity').mockRejectedValue(
            new ApiError(409, {
                error: 'referenced',
                references: [
                    { file: 'data/chapters/village/village.chapter.ts', line: 7, text: "location: 'village'" },
                ],
            })
        );
        expect(await store.deleteLocation('village')).toBe('referenced');
        expect(store.map?.locations.village).toBeDefined();
        expect(store.locations.has('village')).toBe(true);
        expect(store.notice?.kind).toBe('error');
        expect(store.notice?.references?.[0].line).toBe(7);
        expect(store.saveStatus).toBe('idle');
    });

    it('saves a location through the entity update and tracks its version', async () => {
        const { api, store } = await setup();
        const before = store.locations.get('village')!;
        const saved = await store.saveLocation(
            'village',
            {
                localCharacters: [
                    { name: 'Pepa', description: 'Smart' },
                    { name: 'Jan', description: 'Smith' },
                ],
            },
            before.version
        );
        expect(saved.version).not.toBe(before.version);
        expect(store.locations.get('village')?.version).toBe(saved.version);
        expect((await api.getEntity('locations', 'village')).localCharacters).toHaveLength(2);
        await expect(store.saveLocation('village', { name: 'x' }, before.version)).rejects.toMatchObject({
            isStale: true,
        });
    });

    it('changes a location colour and polygon through the autosave', async () => {
        const { api, store } = await setup();
        store.setLocationColor('kingdom', '#336699');
        store.setLocationPolygon('kingdom', [
            { x: 0, y: 0 },
            { x: 10.04, y: 0 },
            { x: 10, y: 10 },
        ]);
        await settle(1000);
        const saved = (await api.getMap('global')).locations.kingdom;
        expect(saved).toEqual({
            polygon: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
            ],
            fill: '#33669959',
            stroke: '#336699',
        });
    });
});
