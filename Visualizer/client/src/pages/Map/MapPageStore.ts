import { action, makeObservable, observable, runInAction } from 'mobx';
import {
    GLOBAL_MAP_ID,
    type TChangeEvent,
    type TLocationDto,
    type TLocationShapeDto,
    type TMapDto,
    type TReferenceDto,
    type TUpdateEntityBody,
} from '@story/visualizer-protocol';
import { ApiError, displayText, type ApiEvents, type TVisualizerApi } from '../../api';
import { Camera, type TCameraState, type TPoint, type TSize } from '../../canvas';
import { createDefaultMapData } from '../../MapEditor/createDefaultMapData';
import { MAP_BORDER, MAX_ZOOM, MIN_ZOOM } from '../../MapEditor/MapEngine/constants';
import { mapWorldBounds } from '../../MapEditor/MapEngine/utils';
import { MapStore, type IMapHost } from '../../MapEditor/MapStore';
import type { TMapDocument } from '../../MapEditor/types';
import type { TConfirmOptions } from '../../shell/modals';
import { getUiState, setUiState } from '../../ui-state';
import { mergeMaps, sameMap, toMapDocument } from './mergeMap';

/** The Map page's modes (plan WP4): read-only, edit location shapes, paint tiles. */
export const MAP_MODES = ['view', 'locations', 'tiles'] as const;
export type TMapMode = (typeof MAP_MODES)[number];

/** `pending` = unsaved changes waiting for the debounce; `saved` = everything is on disk. */
export type TSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export type TMapNotice = { kind: 'info' | 'warning' | 'error'; text: string; references?: TReferenceDto[] };

export type TDeleteResult = 'deleted' | 'cancelled' | 'referenced' | 'failed';

export type TMapPageStoreOptions = {
    api: TVisualizerApi;
    /** Live-refresh feed; omit in tests that do not need it. */
    events?: ApiEvents;
    mapId?: string;
    /** Debounce between the last edit and the save. Default 1000 ms. */
    autosaveMs?: number;
    /** Yes/no dialog for deletes (the shell's `modals.confirm` in the app). */
    confirm?: (options: TConfirmOptions) => Promise<boolean>;
    /** Keep mode and camera in `sessionStorage` (`ui-state`). Default true. */
    persistUiState?: boolean;
};

const UI_MODE_KEY = 'map:mode';
const UI_CAMERA_KEY = 'map:camera';
/** Location ids become file names and TS identifiers (`<id>.location.ts`, `<id>Location`). */
export const LOCATION_ID_RE = /^[a-z][A-Za-z0-9_]*$/;
const MAX_STALE_RETRIES = 3;

const LOCATION_COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac', '#f06292', '#aed581'];

/** A pleasant default colour per location id (stable, so reloads do not reshuffle). */
export const defaultLocationColor = (id: string) => {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return LOCATION_COLORS[h % LOCATION_COLORS.length];
};

/** The `#rrggbb` a shape is drawn in (its stroke, or the opaque part of its fill). */
export const locationColor = (id: string, shape: TLocationShapeDto | undefined): string => {
    for (const candidate of [shape?.stroke, shape?.fill]) {
        if (!candidate) continue;
        if (/^#[0-9a-fA-F]{6}/.test(candidate)) return candidate.slice(0, 7).toLowerCase();
        const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(candidate);
        if (rgb)
            return `#${rgb
                .slice(1, 4)
                .map((c) => Math.min(255, +c).toString(16).padStart(2, '0'))
                .join('')}`;
    }
    return defaultLocationColor(id);
};

/** Fill and stroke for a location colour: the fill is the colour at 35 % opacity. */
export const locationStyle = (color: string): Pick<TLocationShapeDto, 'fill' | 'stroke'> => ({
    fill: `${color.slice(0, 7)}59`,
    stroke: color.slice(0, 7),
});

const errorMessage = (e: unknown) => {
    if (e instanceof ApiError && e.isNotImplemented) return _('The Visualizer server does not implement this yet');
    return e instanceof Error ? e.message : String(e);
};

/**
 * Everything the Map page does that is not drawing: loading and autosaving `map.json`, the
 * location entities, the mode, the shared camera and live refresh. Framework-free apart from
 * MobX, so the tests drive it against `createMockApi` without a DOM canvas.
 *
 * Saving: every edit (`onMapEdited`) marks the document dirty and (re)starts a debounce timer;
 * when it fires the whole document is PUT with the version it was based on. A `409 stale` merges
 * the local edits into the server's current map (`mergeMaps`) and saves again. Events for this
 * map refetch it in place, merging when there are unsaved edits.
 */
export class MapPageStore implements IMapHost {
    readonly api: TVisualizerApi;
    readonly mapId: string;
    readonly camera: Camera;
    readonly tiles: MapStore;

    loadState: 'loading' | 'ready' | 'error' = 'loading';
    loadError: string | null = null;
    /** The document being edited. Not deeply observable (a map has thousands of tiles): watch `revision`. */
    map: TMapDocument | null = null;
    /** Version of `map.json` the local document is based on; `''` = the file does not exist yet. */
    version = '';
    revision = 0;
    mode: TMapMode;
    saveStatus: TSaveStatus = 'idle';
    saveError: string | null = null;
    notice: TMapNotice | null = null;
    locations = observable.map<string, TLocationDto>([], { deep: false });
    selectedLocationId: string | null = null;
    /** Size of the canvas area in CSS px (set by the view), for "middle of the view" and camera bounds. */
    viewport: TSize = { width: 0, height: 0 };
    /** Whether the camera came from `ui-state` (else the view fits the map once it knows its size). */
    readonly hasSavedCamera: boolean;
    /** Size of the empty map shown while there is no `map.json`: the story's `mapSize`. */
    private emptySize: { width: number; height: number } | null = null;

    private readonly events?: ApiEvents;
    private readonly autosaveMs: number;
    private readonly confirm: (options: TConfirmOptions) => Promise<boolean>;
    private readonly persist: boolean;
    /** The last document known to be on the server (base of the three-way merge). */
    private base: TMapDocument | null = null;
    private dirty = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private saving: Promise<void> | null = null;
    private refetchAfterSave = false;
    private cameraTimer: ReturnType<typeof setTimeout> | null = null;
    private cameraMoved = false;
    private disposers: (() => void)[] = [];
    private destroyed = false;

    constructor(options: TMapPageStoreOptions) {
        this.api = options.api;
        this.events = options.events;
        this.mapId = options.mapId ?? GLOBAL_MAP_ID;
        this.autosaveMs = options.autosaveMs ?? 1000;
        this.confirm = options.confirm ?? (() => Promise.resolve(true));
        this.persist = options.persistUiState ?? true;

        const savedMode = this.persist ? getUiState<string>(UI_MODE_KEY, 'view') : 'view';
        this.mode = (MAP_MODES as readonly string[]).includes(savedMode) ? (savedMode as TMapMode) : 'view';
        const savedCamera = this.persist ? getUiState<TCameraState | null>(UI_CAMERA_KEY, null) : null;
        this.hasSavedCamera = isCameraState(savedCamera);
        this.camera = new Camera({
            ...(this.hasSavedCamera ? savedCamera : { zoom: 1 }),
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            constrain: (next) => this.constrainCamera(next),
        });
        this.tiles = new MapStore(this);
        this.tiles.setInteractive(this.mode === 'tiles');

        makeObservable<MapPageStore, 'applyRemote' | 'setSaveStatus'>(this, {
            loadState: observable,
            loadError: observable,
            map: observable.ref,
            version: observable,
            revision: observable,
            mode: observable,
            saveStatus: observable,
            saveError: observable,
            notice: observable.ref,
            selectedLocationId: observable,
            viewport: observable.ref,
            setMode: action,
            setViewport: action,
            onMapEdited: action,
            selectLocation: action,
            setLocationPolygon: action,
            setLocationColor: action,
            placeLocation: action,
            setNotice: action,
            applyRemote: action,
            setSaveStatus: action,
        });
    }

    // ---- lifecycle ---------------------------------------------------------------------------

    /** Loads the map and the locations and starts live refresh. */
    init = async () => {
        if (this.events) {
            this.disposers.push(
                this.events.subscribe({ kind: 'map', id: this.mapId }, () => void this.refetchMap()),
                this.events.subscribe('entity', (e) => this.onEntityEvent(e)),
                this.events.onResync(() => {
                    void this.refetchMap();
                    void this.loadLocations();
                })
            );
        }
        if (this.persist) {
            this.disposers.push(
                this.camera.subscribe(() => {
                    this.cameraMoved = true;
                    if (this.cameraTimer) return;
                    this.cameraTimer = setTimeout(() => {
                        this.cameraTimer = null;
                        setUiState(UI_CAMERA_KEY, this.camera.state);
                    }, 250);
                })
            );
        }
        await this.load();
    };

    /** Stops timers and subscriptions. Unsaved edits are saved right away (not awaited). */
    destroy = () => {
        if (this.destroyed) return;
        this.destroyed = true;
        for (const d of this.disposers.splice(0)) d();
        if (this.cameraTimer) clearTimeout(this.cameraTimer);
        // only a camera that was actually set (fit, pan, zoom); else the next mount would skip its fit
        if (this.persist && this.cameraMoved) setUiState(UI_CAMERA_KEY, this.camera.state);
        this.tiles.detach();
        if (this.dirty) void this.flush();
        else if (this.timer) clearTimeout(this.timer);
    };

    load = async () => {
        runInAction(() => {
            this.loadState = 'loading';
            this.loadError = null;
        });
        try {
            await Promise.all([this.loadMap(), this.loadLocations()]);
            runInAction(() => (this.loadState = 'ready'));
            this.ensureInitialView();
        } catch (e) {
            runInAction(() => {
                this.loadState = 'error';
                this.loadError = errorMessage(e);
            });
        }
    };

    private loadMap = async () => {
        try {
            const dto = await this.api.getMap(this.mapId);
            this.applyRemote(dto, 'replace');
        } catch (e) {
            if (!(e instanceof ApiError && e.isNotFound)) throw e;
            // No map.json yet: start from an empty map of the story's size (`story.json`). It is
            // written with the first edit. (The server answers such a map itself; the mock 404s.)
            this.emptySize = (await this.api.getStoryInfo().catch(() => null))?.mapSize ?? null;
            this.applyRemote(null, 'replace');
        }
    };

    loadLocations = async () => {
        const list = await this.api.listEntities('locations');
        runInAction(() => {
            this.locations.replace(list.entities.map((l) => [l.id, l]));
            if (this.selectedLocationId && !this.map?.locations[this.selectedLocationId]) {
                this.selectedLocationId = null;
            }
        });
    };

    /**
     * Takes a server version of the map (`null` = no file). `replace` drops local edits;
     * `merge` keeps them on top of it (three-way, against `base`).
     */
    private applyRemote(dto: TMapDto | null, how: 'replace' | 'merge') {
        const remote = dto ? toMapDocument(dto) : null;
        const local = this.map;
        if (how === 'merge' && local) {
            this.map = remote ? mergeMaps(this.base, local, remote) : local;
        } else {
            this.map =
                remote ?? createDefaultMapData(this.mapId, _('World'), this.emptySize?.width, this.emptySize?.height);
            this.dirty = false;
        }
        this.base = remote ? structuredClone(remote) : null;
        this.version = dto?.version ?? '';
        if (this.selectedLocationId && !this.map.locations[this.selectedLocationId]) this.selectedLocationId = null;
        this.revision++;
        this.tiles.onDataReplaced();
    }

    /** Live refresh of the map (an event, or a reconnect). */
    refetchMap = async () => {
        if (this.destroyed) return;
        if (this.saving) {
            this.refetchAfterSave = true;
            return;
        }
        let dto: TMapDto | null;
        try {
            dto = await this.api.getMap(this.mapId);
        } catch (e) {
            if (!(e instanceof ApiError && e.isNotFound)) {
                this.setNotice({ kind: 'error', text: _('Could not refresh the map: %s', errorMessage(e)) });
                return;
            }
            dto = null;
        }
        if (this.saving) {
            // a save started while fetching: it knows better, refetch once it is done
            this.refetchAfterSave = true;
            return;
        }
        if (dto && dto.version === this.version) return;
        if (this.dirty) {
            this.applyRemote(dto, 'merge');
            this.setNotice({
                kind: 'info',
                text: _('The map changed on disk; your unsaved edits were merged into it.'),
            });
            this.scheduleSave();
        } else {
            this.applyRemote(dto, 'replace');
        }
    };

    private onEntityEvent(e: TChangeEvent) {
        if (!e.id.startsWith('locations/') && e.id !== '*') return;
        const id = e.id.slice('locations/'.length);
        if (e.id === '*' || id === '*' || id === '') {
            void this.loadLocations();
        } else if (e.op === 'deleted' || e.version === null) {
            runInAction(() => this.locations.delete(id));
        } else {
            void this.refetchLocation(id);
        }
    }

    refetchLocation = async (id: string) => {
        try {
            const dto = await this.api.getEntity('locations', id);
            runInAction(() => this.locations.set(id, dto));
            return dto;
        } catch (e) {
            if (e instanceof ApiError && e.isNotFound) runInAction(() => this.locations.delete(id));
            return undefined;
        }
    };

    // ---- modes, camera -----------------------------------------------------------------------

    setMode = (mode: TMapMode) => {
        if (mode === this.mode) return;
        this.mode = mode;
        if (mode !== 'locations') this.selectedLocationId = null;
        this.tiles.setInteractive(mode === 'tiles');
        if (this.persist) setUiState(UI_MODE_KEY, mode);
    };

    get editable() {
        return this.mode !== 'view';
    }

    setViewport = (size: TSize) => {
        this.viewport = size;
        this.ensureInitialView();
    };

    private fitted = false;

    /** Without a saved camera, fit the map into the view once both the map and the view size are known. */
    private ensureInitialView() {
        if (this.fitted || this.hasSavedCamera || !this.map || this.viewport.width <= 0) return;
        this.fitted = true;
        this.fitMap();
    }

    /** World point in the middle of the view. */
    viewCenter = (): TPoint => this.camera.screenToWorld({ x: this.viewport.width / 2, y: this.viewport.height / 2 });

    /** Zooms and pans so the whole map is in view. */
    fitMap = () => {
        if (!this.map || this.viewport.width <= 0) return;
        this.camera.fitRect(mapWorldBounds(this.map), this.viewport, 20);
    };

    /** Keeps at least a strip of the map in view. */
    private constrainCamera(next: TCameraState): TCameraState {
        const map = this.map;
        if (!map) return next;
        const b = mapWorldBounds(map);
        const viewW = this.viewport.width / next.zoom;
        const viewH = this.viewport.height / next.zoom;
        const padX = Math.min(MAP_BORDER, b.width / 2);
        const padY = Math.min(MAP_BORDER, b.height / 2);
        const clamp = (v: number, lo: number, hi: number) => (lo > hi ? v : Math.min(hi, Math.max(lo, v)));
        return {
            ...next,
            x: clamp(next.x, b.x - viewW + padX, b.x + b.width - padX),
            y: clamp(next.y, b.y - viewH + padY, b.y + b.height - padY),
        };
    }

    // ---- saving ------------------------------------------------------------------------------

    /** `IMapHost`: tiles, texts, palette or shapes changed. */
    onMapEdited = () => {
        if (!this.map) return;
        this.dirty = true;
        this.revision++;
        this.scheduleSave();
    };

    get hasUnsavedChanges() {
        return this.dirty || this.saving !== null;
    }

    private scheduleSave() {
        if (this.destroyed && !this.dirty) return;
        if (this.timer) clearTimeout(this.timer);
        this.setSaveStatus('pending');
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.save();
        }, this.autosaveMs);
    }

    /** Saves now (skipping the debounce) and resolves when everything is on disk or failed. */
    flush = async () => {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.saving) await this.saving;
        if (this.dirty) await this.save();
    };

    /** One PUT of the whole document; re-runs itself on `409 stale` (after merging) and for edits made meanwhile. */
    save = async (): Promise<void> => {
        if (this.saving) {
            await this.saving;
            if (this.dirty && !this.timer) return this.save();
            return;
        }
        if (!this.map || !this.dirty) return;
        this.saving = this.doSave();
        try {
            await this.saving;
        } finally {
            this.saving = null;
        }
        if (this.refetchAfterSave) {
            this.refetchAfterSave = false;
            await this.refetchMap();
        }
        if (this.dirty && !this.timer && this.saveStatus !== 'error') this.scheduleSave();
    };

    private async doSave() {
        for (let attempt = 0; attempt <= MAX_STALE_RETRIES; attempt++) {
            const map = this.map;
            if (!map) return;
            const snapshot = structuredClone(map);
            this.dirty = false;
            this.setSaveStatus('saving');
            try {
                const saved = await this.api.updateMap(this.mapId, { ...snapshot, version: this.version });
                runInAction(() => {
                    this.base = snapshot;
                    this.version = saved.version;
                });
                this.setSaveStatus(this.dirty ? 'pending' : 'saved');
                return;
            } catch (e) {
                this.dirty = true;
                if (e instanceof ApiError && e.isStale && attempt < MAX_STALE_RETRIES) {
                    // Someone else wrote map.json since we read it: merge and try again.
                    this.applyRemote((e.current as TMapDto | null) ?? null, 'merge');
                    if (sameMap(this.map, this.base)) {
                        this.dirty = false;
                        this.setSaveStatus('saved');
                        return;
                    }
                    this.setNotice({
                        kind: 'info',
                        text: _('The map changed on disk while you were editing; your edits were merged into it.'),
                    });
                    continue;
                }
                this.setSaveStatus('error', errorMessage(e));
                return;
            }
        }
    }

    private setSaveStatus(status: TSaveStatus, error: string | null = null) {
        this.saveStatus = status;
        this.saveError = error;
    }

    /** "Retry" of the error indicator. */
    retrySave = () => {
        this.dirty = true;
        return this.flush();
    };

    setNotice = (notice: TMapNotice | null) => {
        this.notice = notice;
    };

    // ---- locations ---------------------------------------------------------------------------

    /** Display name of a location (its literal name, the text inside `_('…')`, or the id). */
    locationName = (id: string) => displayText(this.locations.get(id)?.name, id);

    /** Location entities that have no shape on the map yet. */
    get unplacedLocations(): TLocationDto[] {
        const shapes = this.map?.locations ?? {};
        return [...this.locations.values()].filter((l) => !shapes[l.id]);
    }

    selectLocation = (id: string | null) => {
        this.selectedLocationId = id;
    };

    setLocationPolygon = (id: string, polygon: TPoint[]) => {
        const shape = this.map?.locations[id];
        if (!shape) return;
        shape.polygon = polygon.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
        this.onMapEdited();
    };

    setLocationColor = (id: string, color: string) => {
        const shape = this.map?.locations[id];
        if (!shape) return;
        Object.assign(shape, locationStyle(color));
        this.onMapEdited();
    };

    /** Gives an existing location a default shape (a hexagon) in the middle of the view. */
    placeLocation = (id: string, center: TPoint = this.viewCenter()) => {
        const map = this.map;
        if (!map || map.locations[id]) return;
        const r = Math.max(30, 90 / Math.max(this.camera.zoom, 0.1));
        map.locations[id] = {
            polygon: [0, 1, 2, 3, 4, 5].map((k) => ({
                x: Math.round(center.x + r * Math.cos((k * Math.PI) / 3)),
                y: Math.round(center.y + r * Math.sin((k * Math.PI) / 3)),
            })),
            ...locationStyle(defaultLocationColor(id)),
        };
        this.selectedLocationId = id;
        this.onMapEdited();
    };

    /** Checks a new location id; returns the error text or null. */
    validateLocationId = (id: string): string | null => {
        if (!id) return _('Enter an id');
        if (!LOCATION_ID_RE.test(id)) {
            return _('Use letters, digits and _, starting with a lower-case letter (no "-" or spaces)');
        }
        if (this.locations.has(id)) return _('Location "%s" already exists', id);
        return null;
    };

    /**
     * Creates the location entity (`POST /entities/locations`), then its shape in the middle
     * of the view, and saves the map right away. Rejects with the `ApiError` (e.g. `409 exists`).
     */
    addLocation = async (body: { id: string; name: string; description?: string }, center?: TPoint) => {
        const invalid = this.validateLocationId(body.id);
        if (invalid) throw new Error(invalid);
        const dto = await this.api.createEntity('locations', {
            id: body.id,
            name: body.name || body.id,
            description: body.description ?? '',
            localCharacters: [],
        });
        runInAction(() => this.locations.set(dto.id, dto));
        this.placeLocation(dto.id, center);
        await this.flush();
        return dto;
    };

    /**
     * Asks, then deletes the location entity (`DELETE`, refused with `409 referenced` while
     * chapters, npcs or passages still point at it) and its shape. A shape without an entity is
     * just removed.
     */
    deleteLocation = async (id: string): Promise<TDeleteResult> => {
        const entity = this.locations.get(id);
        const name = this.locationName(id);
        const ok = await this.confirm({
            title: _('Delete location %s?', name),
            message: entity
                ? _("This deletes %s and the location's shape on the map.", entity.file)
                : _('There is no location file for "%s"; only its shape on the map is removed.', id),
            danger: true,
        });
        if (!ok) return 'cancelled';
        this.setNotice(null);
        if (entity) {
            try {
                await this.api.deleteEntity('locations', id, { version: entity.version });
            } catch (e) {
                if (e instanceof ApiError && e.isReferenced) {
                    this.setNotice({
                        kind: 'error',
                        text: _('%s is still used and was not deleted:', name),
                        references: e.references,
                    });
                    return 'referenced';
                }
                if (e instanceof ApiError && e.isStale) {
                    await this.refetchLocation(id);
                    this.setNotice({
                        kind: 'warning',
                        text: _('%s changed on disk; check it and delete again.', name),
                    });
                    return 'failed';
                }
                if (!(e instanceof ApiError && e.isNotFound)) {
                    this.setNotice({ kind: 'error', text: _('Could not delete %s: %s', name, errorMessage(e)) });
                    return 'failed';
                }
            }
        }
        runInAction(() => {
            this.locations.delete(id);
            if (this.map?.locations[id]) {
                delete this.map.locations[id];
                this.onMapEdited();
            }
            if (this.selectedLocationId === id) this.selectedLocationId = null;
        });
        await this.flush();
        return 'deleted';
    };

    /**
     * `PUT /entities/locations/:id` with the changed fields. Rejects with the `ApiError`
     * (the form handles `409 stale`: "reload / keep mine").
     */
    saveLocation = async (id: string, patch: Omit<TUpdateEntityBody<'locations'>, 'version'>, version: string) => {
        const dto = await this.api.updateEntity('locations', id, { ...patch, version });
        runInAction(() => this.locations.set(id, dto));
        return dto;
    };
}

const isCameraState = (v: unknown): v is TCameraState =>
    typeof v === 'object' &&
    v !== null &&
    ['x', 'y', 'zoom'].every((k) => Number.isFinite((v as Record<string, unknown>)[k])) &&
    (v as TCameraState).zoom > 0;
