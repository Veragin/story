import { action, makeObservable, observable, runInAction } from 'mobx';
import {
    GLOBAL_MAP_ID,
    type TChangeEvent,
    type TLocationDto,
    type TLocationShapeDto,
    type TMapDto,
    type TReferenceDto,
    type TUpdateEntityBody,
} from '@story/protocol';
import { isOneOf } from '@story/shared';
import { ApiError, displayText, errorMessage, type ApiEvents, type TVisualizerApi } from '../../api';
import { Camera, type TCameraState, type TPoint, type TSize } from '../../canvas';
import { createDefaultMapData } from '../../MapEditor/createDefaultMapData';
import { MAP_BORDER, MAX_ZOOM, MIN_ZOOM } from '../../MapEditor/MapEngine/constants';
import { mapWorldBounds } from '../../MapEditor/MapEngine/utils';
import { MapStore, type IMapHost } from '../../MapEditor/MapStore';
import type { TMapDocument } from '../../MapEditor/types';
import type { TConfirmOptions } from '../../shell/modals';
import { getUiState, setUiState } from '../../ui-state';
import type { TSaveStatus } from '../../components/feedback/SaveStatus';
import { mergeMaps, sameMap, toMapDocument } from './mergeMap';
import { nameAsText, withNameText } from './locationName';
import { descendantLocationIds, isOnMap, locationIdPrefix, mapAncestors, parentLocationId } from './locationTree';

export const MAP_MODES = ['view', 'locations', 'tiles'] as const;
export type TMapMode = (typeof MAP_MODES)[number];

export type TMapNotice = { kind: 'info' | 'warning' | 'error'; text: string; references?: TReferenceDto[] };

export type TDeleteResult = 'deleted' | 'cancelled' | 'referenced' | 'failed';

export type TDeleteLocationRequest = {
    locationId: string;
    name: string;
    file: string | null;
    hasMap: boolean;
    sublocationIds: string[];
};

export type TDeleteLocationChoice = { map: boolean; sublocations: boolean; location: boolean };

export type TMapSize = { width: number; height: number };

export type TMapPageStoreOptions = {
    api: TVisualizerApi;
    events?: ApiEvents;
    mapId?: string;
    autosaveMs?: number;
    confirm?: (options: TConfirmOptions) => Promise<boolean>;
    askDelete?: (request: TDeleteLocationRequest) => Promise<TDeleteLocationChoice | null>;
    persistUiState?: boolean;
};

const UI_MODE_KEY = 'map:mode';
const UI_CAMERA_KEY = 'map:camera';
export const LOCATION_ID_RE = /^[a-z][A-Za-z0-9_]*$/;
const MAX_STALE_RETRIES = 3;

const LOCATION_FILL_ALPHA = '73';

const LOCATION_COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac', '#f06292', '#aed581'];

export const defaultLocationColor = (id: string) => {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return LOCATION_COLORS[h % LOCATION_COLORS.length];
};

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

export const locationStyle = (color: string): Pick<TLocationShapeDto, 'fill' | 'stroke'> => ({
    fill: `${color.slice(0, 7)}${LOCATION_FILL_ALPHA}`,
    stroke: color.slice(0, 7),
});

export class MapPageStore implements IMapHost {
    readonly api: TVisualizerApi;
    readonly mapId: string;
    readonly camera: Camera;
    readonly tiles: MapStore;

    loadState: 'loading' | 'ready' | 'missing' | 'error' = 'loading';
    loadError: string | null = null;
    // shallow: thousands of tiles; watch `revision`
    map: TMapDocument | null = null;
    // '' = no map.json yet
    version = '';
    revision = 0;
    mode: TMapMode;
    saveStatus: TSaveStatus = 'idle';
    saveError: string | null = null;
    notice: TMapNotice | null = null;
    locations = observable.map<string, TLocationDto>([], { deep: false });
    // a location's own map: its version, null when it has none; absent until asked
    locationMaps = observable.map<string, string | null>();
    selectedLocationId: string | null = null;
    viewport: TSize = { width: 0, height: 0 };
    readonly hasSavedCamera: boolean;
    private emptySize: { width: number; height: number } | null = null;

    private readonly events?: ApiEvents;
    private readonly autosaveMs: number;
    private readonly confirm: (options: TConfirmOptions) => Promise<boolean>;
    private readonly askDelete: (request: TDeleteLocationRequest) => Promise<TDeleteLocationChoice | null>;
    private readonly cameraKey: string;
    private readonly persist: boolean;
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
        this.askDelete = options.askDelete ?? this.confirmDeleteAll;
        this.persist = options.persistUiState ?? true;
        this.cameraKey = this.isGlobal ? UI_CAMERA_KEY : `${UI_CAMERA_KEY}:${this.mapId}`;

        const savedMode = this.persist ? getUiState<string>(UI_MODE_KEY, 'view') : 'view';
        this.mode = isOneOf(savedMode, MAP_MODES) ? savedMode : 'view';
        const savedCamera = this.persist ? getUiState<TCameraState | null>(this.cameraKey, null) : null;
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

    init = async () => {
        if (this.events) {
            this.disposers.push(
                this.events.subscribe('map', (e) => this.onMapEvent(e)),
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
                        setUiState(this.cameraKey, this.camera.state);
                    }, 250);
                })
            );
        }
        await this.load();
    };

    destroy = () => {
        if (this.destroyed) return;
        this.destroyed = true;
        for (const d of this.disposers.splice(0)) d();
        if (this.cameraTimer) clearTimeout(this.cameraTimer);
        // an untouched camera must not suppress the next mount's fit
        if (this.persist && this.cameraMoved) setUiState(this.cameraKey, this.camera.state);
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
                this.loadState = e instanceof MissingMapError ? 'missing' : 'error';
                this.loadError = errorMessage(e);
            });
        }
    };

    get isGlobal() {
        return this.mapId === GLOBAL_MAP_ID;
    }

    private loadMap = async () => {
        try {
            const dto = await this.api.getMap(this.mapId);
            this.applyRemote(dto, 'replace');
        } catch (e) {
            if (!(e instanceof ApiError && e.isNotFound)) throw e;
            if (!this.isGlobal) throw new MissingMapError();
            // the server answers an empty map itself; the mock 404s
            const info = await this.api.getStoryInfo().catch(() => null);
            this.emptySize = info?.access === 'edit' ? info.mapSize : null;
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
            if (!this.isGlobal) {
                runInAction(() => (this.loadState = 'missing'));
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

    private onMapEvent(e: TChangeEvent) {
        if (e.id === this.mapId) void this.refetchMap();
        if (this.locationMaps.has(e.id)) runInAction(() => this.locationMaps.set(e.id, e.version));
    }

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

    private ensureInitialView() {
        if (this.fitted || this.hasSavedCamera || !this.map || this.viewport.width <= 0) return;
        this.fitted = true;
        this.fitMap();
    }

    viewCenter = (): TPoint => this.camera.screenToWorld({ x: this.viewport.width / 2, y: this.viewport.height / 2 });

    fitMap = () => {
        if (!this.map || this.viewport.width <= 0) return;
        this.camera.fitRect(mapWorldBounds(this.map), this.viewport, 20);
    };

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

    flush = async () => {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.saving) await this.saving;
        if (this.dirty) await this.save();
    };

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

    retrySave = () => {
        this.dirty = true;
        return this.flush();
    };

    setNotice = (notice: TMapNotice | null) => {
        this.notice = notice;
    };

    locationName = (id: string) => displayText(this.locations.get(id)?.name, id);

    get unplacedLocations(): TLocationDto[] {
        const shapes = this.map?.locations ?? {};
        return [...this.locations.values()].filter((l) => !shapes[l.id] && isOnMap(l.id, this.mapId, this.locations));
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

    validateLocationId = (id: string): string | null => {
        if (!id) return _('Enter an id');
        if (!LOCATION_ID_RE.test(id)) {
            return _('Use letters, digits and _, starting with a lower-case letter (no "-" or spaces)');
        }
        if (this.locations.has(id)) return _('Location "%s" already exists', id);
        return null;
    };

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

    get locationIdPrefix() {
        return locationIdPrefix(this.mapId);
    }

    sublocationIds = (id: string) => descendantLocationIds(id, this.locations.keys());

    childLocationIds = (id: string) => [...this.locations.keys()].filter((other) => isOnMap(other, id, this.locations));

    get ancestorMapIds() {
        return mapAncestors(this.mapId, this.locations);
    }

    get parentMapId() {
        return parentLocationId(this.mapId, this.locations) ?? GLOBAL_MAP_ID;
    }

    fetchLocationMap = async (id: string): Promise<string | null> => {
        let version: string | null;
        try {
            version = (await this.api.getMap(id)).version;
        } catch (e) {
            if (!(e instanceof ApiError && e.isNotFound)) throw e;
            version = null;
        }
        runInAction(() => this.locationMaps.set(id, version));
        return version;
    };

    createLocationMap = async (id: string, { width, height }: TMapSize) => {
        const map = createDefaultMapData(id, this.locationName(id), width, height);
        const dto = await this.api.updateMap(id, { ...map, version: '' });
        runInAction(() => this.locationMaps.set(id, dto.version));
    };

    private confirmDeleteAll = async (request: TDeleteLocationRequest): Promise<TDeleteLocationChoice | null> => {
        const ok = await this.confirm({
            title: _('Delete location %s?', request.name),
            message: request.file
                ? _("This deletes %s and the location's shape on the map.", request.file)
                : _('There is no location file for "%s"; only its shape on the map is removed.', request.locationId),
            danger: true,
        });
        return ok ? { map: true, sublocations: true, location: true } : null;
    };

    deleteLocation = async (id: string): Promise<TDeleteResult> => {
        const entity = this.locations.get(id);
        const sublocationIds = this.sublocationIds(id);
        const hasMap = (await this.fetchLocationMap(id).catch(() => null)) !== null;
        const choice = await this.askDelete({
            locationId: id,
            name: this.locationName(id),
            file: entity?.file ?? null,
            hasMap,
            sublocationIds,
        });
        if (!choice || (!choice.location && !choice.map && !choice.sublocations)) return 'cancelled';
        this.setNotice(null);

        if (choice.location || choice.sublocations) {
            for (const sub of sublocationIds) {
                const result = await this.deleteLocationEntity(sub);
                if (result !== 'deleted') return result;
            }
        }
        if (choice.location) {
            const result = await this.deleteLocationEntity(id);
            if (result !== 'deleted') return result;
        } else if (choice.map && hasMap) {
            const result = await this.deleteLocationMap(id);
            if (result !== 'deleted') return result;
        }
        await this.flush();
        return 'deleted';
    };

    private deleteLocationMap = async (id: string): Promise<TDeleteResult> => {
        const name = this.locationName(id);
        try {
            await this.api.deleteMap(id, { version: this.locationMaps.get(id) ?? '' });
        } catch (e) {
            if (e instanceof ApiError && e.isStale) {
                await this.fetchLocationMap(id);
                this.setNotice({ kind: 'warning', text: _('The map of %s changed on disk; delete it again.', name) });
                return 'failed';
            }
            if (!(e instanceof ApiError && e.isNotFound)) {
                this.setNotice({
                    kind: 'error',
                    text: _('Could not delete the map of %s: %s', name, errorMessage(e)),
                });
                return 'failed';
            }
        }
        runInAction(() => this.locationMaps.set(id, null));
        return 'deleted';
    };

    // the server also drops its shape and its own map
    private deleteLocationEntity = async (id: string): Promise<TDeleteResult> => {
        const entity = this.locations.get(id);
        const name = this.locationName(id);
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
            this.locationMaps.set(id, null);
            if (this.map?.locations[id]) {
                delete this.map.locations[id];
                this.onMapEdited();
            }
            if (this.selectedLocationId === id) this.selectedLocationId = null;
        });
        return 'deleted';
    };

    renameLocation = async (id: string, text: string) => {
        const location = this.locations.get(id);
        if (!location || nameAsText(location.name) === text) return;
        try {
            await this.saveLocation(id, { name: withNameText(location.name, text) }, location.version);
        } catch (e) {
            this.setNotice({ kind: 'error', text: _('Could not rename %s: %s', id, errorMessage(e)) });
        }
    };

    saveLocation = async (id: string, patch: Omit<TUpdateEntityBody<'locations'>, 'version'>, version: string) => {
        const dto = await this.api.updateEntity('locations', id, { ...patch, version });
        runInAction(() => this.locations.set(id, dto));
        return dto;
    };
}

class MissingMapError extends Error {
    constructor() {
        super(_('This location has no map yet'));
    }
}

const isCameraState = (v: unknown): v is TCameraState =>
    typeof v === 'object' &&
    v !== null &&
    'x' in v &&
    'y' in v &&
    'zoom' in v &&
    Number.isFinite(v.x) &&
    Number.isFinite(v.y) &&
    typeof v.zoom === 'number' &&
    Number.isFinite(v.zoom) &&
    v.zoom > 0;
