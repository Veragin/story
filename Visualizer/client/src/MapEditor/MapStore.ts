import {
    BrushStroke,
    BrushTool,
    History,
    ImageObject,
    Keyboard,
    Navigation,
    NoteObject,
    NoteTool,
    PolygonDrawTool,
    PolygonObject,
    Scene,
    SelectTool,
    Selection,
    Snapping,
    ToolManager,
    VertexEditTool,
    type TNoteEditRequest,
} from '@story/canvas';
import { resolveAsset } from '@story/data/assets';
import { showToast } from '@story/shared';
import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TLocationSummary, TMapSummary } from '../../../server/src/story/types';
import type { Agent } from '../stores/Agent';

/**
 * The map tab (VISUALIZER_PLAN §7, Phase 6 — "the first real consumer").
 *
 * ## What replaced what
 *
 * All of this used to be a `width × height` grid of palette ids blitted by a bespoke tile engine
 * (`MapEditor/MapEngine/**`). Nothing in the README ever asked for a tile grid; it asks for
 * polygon locations, a brush and notes (§1.1). The tile model, its engine, its palette and
 * `createDefaultMapData` are deleted, and this store drives a `@story/canvas` `Scene` instead.
 *
 * ## The mapping between scene objects and story entities
 *
 * `@story/canvas` knows nothing about locations (design rule 2), so the correspondence lives
 * here, carried in each object's `meta`:
 *
 *   `PolygonObject`  `meta.locationId`  ←→  `TLocation.shape`  — one file per location
 *   `BrushStroke`    `meta.strokeId`    ←→  `TMap.strokes[]`   — all in the map file
 *   `NoteObject`     `meta.noteId`      ←→  `TMap.notes[]`     — all in the map file
 *
 * That split is why saving is two kinds of request: a location's polygon goes to
 * `PUT /api/location/:id`, the map's own furniture to `PUT /api/map/:id`. It is also why only
 * *dirty* locations are written — saving all of them would rewrite every location file in the
 * story on every brush stroke.
 *
 * ## Why the canvas state is not mobx-observable
 *
 * Scene objects are mutated at pointer-event rate. Only what React actually renders — the active
 * tool, the selected location, the dirty flag — is `observable`. Making the scene observable
 * would re-render the toolbar on every drag frame, which is exactly what §2 rejected
 * `react-konva` to avoid.
 */

/** Keys the store puts on scene objects, so it can find its way back to the story. */
const META_LOCATION = 'locationId';
const META_STROKE = 'strokeId';
const META_NOTE = 'noteId';

export type TMapTool = 'select' | 'polygon-draw' | 'vertex-edit' | 'brush' | 'note';

/** The minimal observer shape `track` needs — `@story/shared`'s `Observer`, structurally. */
type TTrackable<T> = {
    subscribe: (handler: (value: T) => void) => void;
    unsubscribe: (handler: (value: T) => void) => void;
};

export class MapStore {
    /* ------------------------------------------------------- observable state */

    activeTool: TMapTool = 'select';
    /** Colour the draw and brush tools use, and what "recolour selection" applies. */
    color = '#4f7fd4';
    brushWidth = 6;
    /** Locations whose shape changed since the last save. */
    dirtyLocationIds: ReadonlySet<string> = new Set();
    /** True when the map's own notes or strokes changed. */
    mapDirty = false;
    saving = false;
    /** The location behind the current selection, for the side panel. */
    selectedLocationId: string | null = null;
    /** True when a polygon is selected that belongs to no location yet. */
    hasUnassignedPolygon = false;
    /** A note waiting for the host to supply text — see `NoteTool`. */
    noteRequest: TNoteEditRequest | null = null;
    canUndo = false;
    canRedo = false;

    /* --------------------------------------------------- non-observable state */

    scene: Scene | null = null;
    private readonly selection = new Selection();
    private readonly history = new History();
    private tools: ToolManager | null = null;
    private navigation: Navigation | null = null;
    private keyboard: Keyboard | null = null;
    private selectTool: SelectTool | null = null;
    private vertexTool: VertexEditTool | null = null;
    private brushTool: BrushTool | null = null;
    private disposers: (() => void)[] = [];
    private nextId = 0;

    /** Content hashes from the last read — the `If-Match` tokens for the next write (§5.3). */
    private readonly locationHashes = new Map<string, string | null>();
    private mapHash: string | null = null;

    constructor(
        private readonly agent: Agent,
        public map: TMapSummary,
        public locations: TLocationSummary[],
        /** Called on double-click, so the host can open the location view. */
        private readonly onOpenLocation: (locationId: string) => void
    ) {
        this.mapHash = map.hash;
        for (const location of locations) this.locationHashes.set(location.id, location.hash);

        makeObservable(this, {
            activeTool: observable,
            color: observable,
            brushWidth: observable,
            dirtyLocationIds: observable.ref,
            mapDirty: observable,
            saving: observable,
            selectedLocationId: observable,
            hasUnassignedPolygon: observable,
            noteRequest: observable.ref,
            canUndo: observable,
            canRedo: observable,
            map: observable.ref,
            locations: observable.ref,

            isDirty: computed,
            selectedLocation: computed,

            setTool: action,
            setColor: action,
            setBrushWidth: action,
            setNoteRequest: action,
        });
    }

    get isDirty(): boolean {
        return this.mapDirty || this.dirtyLocationIds.size > 0;
    }

    get selectedLocation(): TLocationSummary | undefined {
        return this.locations.find((location) => location.id === this.selectedLocationId);
    }

    /* --------------------------------------------------------------- mounting */

    /** Wires a mounted scene up. Returns the teardown `CanvasHost` will call. */
    attach = (scene: Scene): (() => void) => {
        this.scene = scene;

        const snapping = new Snapping({
            // No grid: a hand-drawn coastline snapped to a grid is worse than one that is not.
            // Vertex snapping is on, because two locations sharing a border exactly is the thing
            // authors most want and can least do by hand.
            gridSize: 0,
            vertexThreshold: 14,
            closeThreshold: 18,
        });

        this.navigation = new Navigation(scene);
        this.keyboard = new Keyboard(scene, { onUndo: this.undo, onRedo: this.redo });

        this.selectTool = new SelectTool({ moveLabel: _('Move') });
        const drawTool = new PolygonDrawTool({
            color: this.color,
            generateId: () => `polygon-${++this.nextId}`,
        });
        this.vertexTool = new VertexEditTool();
        this.brushTool = new BrushTool({
            color: this.color,
            width: this.brushWidth,
            // Below the locations: a river drawn over a region would hide it.
            layer: 'background',
            generateId: () => `stroke-${this.freshEntityId()}`,
        });
        const noteTool = new NoteTool({ color: '#ffffff', generateId: () => `note-${this.freshEntityId()}` });

        this.tools = new ToolManager({
            scene,
            selection: this.selection,
            history: this.history,
            snapping,
            navigation: this.navigation,
        });
        this.tools.registerAll([this.selectTool, drawTool, this.vertexTool, this.brushTool, noteTool]);

        this.track<{ tool: { name: string } }>(this.tools.onToolChanged, ({ tool }) =>
            runInAction(() => (this.activeTool = tool.name as TMapTool))
        );

        this.track(this.selection.onChange, ({ selected }) => {
            const polygon = selected.find((object): object is PolygonObject => object instanceof PolygonObject);
            runInAction(() => {
                this.selectedLocationId = polygon?.getMeta<string>(META_LOCATION) ?? null;
                this.hasUnassignedPolygon = polygon !== undefined && this.selectedLocationId === null;
            });
        });

        // README: "map: double-click opens location view".
        this.track(this.selectTool.onOpen, ({ object }) => {
            const locationId = object.getMeta<string>(META_LOCATION);
            if (locationId) this.onOpenLocation(locationId);
        });

        // A freshly drawn polygon belongs to no location yet — which one is the author's next
        // decision, so it is left selected and the side panel asks.
        this.track(drawTool.onCreated, ({ polygon, selfIntersecting }) => {
            this.tools?.activateDefault();
            if (selfIntersecting) {
                showToast(_('That shape crosses itself — its area and centre are undefined.'), {
                    variant: 'warning',
                });
            }
            this.selection.set([polygon]);
        });

        this.track(this.vertexTool.onChanged, ({ polygon }) => this.markPolygonDirty(polygon));

        this.track(this.brushTool.onCreated, (stroke) => {
            this.adopt(stroke, META_STROKE, 'stroke-');
            runInAction(() => (this.mapDirty = true));
        });

        this.track(noteTool.onEditRequested, (request) => this.setNoteRequest(request));
        this.track(noteTool.onCreated, (note) => {
            this.adopt(note, META_NOTE, 'note-');
            runInAction(() => (this.mapDirty = true));
        });

        // One subscription for every object mutation, rather than one per object — which is
        // what `Scene.onObjectChanged` exists for.
        this.track(scene.onObjectChanged, ({ object, property }) => {
            if (property === 'selected' || property === 'hovered') return;
            if (object instanceof PolygonObject) this.markPolygonDirty(object);
            else if (object instanceof BrushStroke || object instanceof NoteObject) {
                runInAction(() => (this.mapDirty = true));
            }
        });

        this.track(this.history.onChange, () =>
            runInAction(() => {
                this.canUndo = this.history.canUndo;
                this.canRedo = this.history.canRedo;
            })
        );

        this.build(scene);

        // Phase 0's spike 2 could not be measured headlessly, so §7's stated fallback is taken
        // up front: the brush layer is the heavy, non-interactive one.
        scene.setLayerCached('background', true);
        scene.fitToContent(60);

        return this.detach;
    };

    private detach = (): void => {
        for (const dispose of this.disposers) dispose();
        this.disposers = [];
        this.tools?.destroy();
        this.keyboard?.destroy();
        this.navigation?.destroy();
        this.tools = null;
        this.keyboard = null;
        this.navigation = null;
        this.scene = null;
    };

    /** Subscribes and records the unsubscribe, so `detach` cannot miss one. */
    private track<T>(observer: TTrackable<T>, handler: (value: T) => void): void {
        observer.subscribe(handler);
        this.disposers.push(() => observer.unsubscribe(handler));
    }

    /* -------------------------------------------------------------- building */

    /** Turns the loaded story data into scene objects. */
    private build(scene: Scene): void {
        if (this.map.background) {
            // Resolved on the client, not the server: `data/assets` is built on
            // `import.meta.glob`, which only exists inside the bundler.
            const url = resolveAsset(this.map.background.asset);
            if (url) {
                scene.add(
                    new ImageObject({
                        id: 'map-background',
                        position: { ...this.map.background.position },
                        size: { ...this.map.background.size },
                        src: url,
                    })
                );
            }
        }

        for (const stroke of this.map.strokes) {
            scene.add(
                new BrushStroke({
                    id: `stroke-${stroke.id}`,
                    layer: 'background',
                    points: [...stroke.points],
                    color: stroke.color,
                    width: stroke.width,
                    meta: { [META_STROKE]: stroke.id },
                })
            );
        }

        for (const location of this.locations) {
            if (location.shape?.mapId !== this.map.id) continue;
            scene.add(
                new PolygonObject({
                    id: `location-${location.id}`,
                    points: location.shape.points.map((point) => ({ ...point })),
                    color: location.shape.color,
                    z: location.shape.z ?? 0,
                    label: location.name,
                    meta: { [META_LOCATION]: location.id },
                })
            );
        }

        for (const note of this.map.notes) {
            scene.add(
                new NoteObject({
                    id: `note-${note.id}`,
                    position: { ...note.position },
                    text: note.text,
                    color: note.color ?? '#ffffff',
                    rotation: note.rotation,
                    meta: { [META_NOTE]: note.id },
                })
            );
        }
    }

    /**
     * A new entity id that cannot collide with one already in `data/`.
     *
     * A plain counter is not enough, and the failure is worth recording because it only appears
     * on the *second* session: a stroke created as `stroke-new-1` is saved to `TMap.strokes`
     * with id `new-1`, comes back on reload as the scene object `stroke-new-1`, and the next
     * stroke the author draws is generated as `stroke-new-1` again — which `Layers.add` rejects
     * as a duplicate id, and the throw breaks every subsequent interaction with the map.
     *
     * The timestamp makes ids unique across sessions and the counter makes them unique within
     * one, which together is exactly the guarantee the round trip needs.
     */
    private freshEntityId(): string {
        return `${Date.now().toString(36)}-${++this.nextId}`;
    }

    /**
     * Records a newly created object's persistent id in its `meta`, so that saving and
     * reloading is the identity function on ids (see `freshEntityId`).
     */
    private adopt(object: BrushStroke | NoteObject, metaKey: string, prefix: string): void {
        if (object.getMeta<string>(metaKey)) return;
        object.setMeta(metaKey, object.id.startsWith(prefix) ? object.id.slice(prefix.length) : object.id);
    }

    private markPolygonDirty(polygon: PolygonObject): void {
        const locationId = polygon.getMeta<string>(META_LOCATION);
        if (!locationId) return;
        runInAction(() => {
            this.dirtyLocationIds = new Set(this.dirtyLocationIds).add(locationId);
        });
    }

    /* ------------------------------------------------------------------ tools */

    setTool = (tool: TMapTool): void => {
        this.tools?.activate(tool);
    };

    setColor = (color: string): void => {
        this.color = color;
        if (this.brushTool) this.brushTool.color = color;

        // README: "click selects; colour change". One undo entry for the whole selection.
        const polygons = this.selection.all.filter(
            (object): object is PolygonObject => object instanceof PolygonObject
        );
        if (polygons.length === 0) return;

        this.history.transaction(_('Recolour'), () => {
            for (const polygon of polygons) {
                const previous = polygon.color;
                this.history.execute({
                    label: _('Recolour'),
                    execute: () => (polygon.color = color),
                    undo: () => (polygon.color = previous),
                });
            }
        });
    };

    setBrushWidth = (width: number): void => {
        this.brushWidth = width;
        if (this.brushTool) this.brushTool.width = width;
    };

    setNoteRequest = (request: TNoteEditRequest | null): void => {
        this.noteRequest = request;
    };

    /** README: "add/edit/remove location as polygon mesh" — the remove half. */
    deleteSelection = (): void => {
        // Capture the locations first: after the delete the objects are gone, and a location
        // whose polygon has been removed still has to be saved — as `shape: null`.
        const locationIds = this.selection.all
            .map((object) => object.getMeta<string>(META_LOCATION))
            .filter((id): id is string => id !== undefined);

        this.selectTool?.deleteSelection();

        runInAction(() => {
            this.mapDirty = true;
            const next = new Set(this.dirtyLocationIds);
            for (const id of locationIds) next.add(id);
            this.dirtyLocationIds = next;
        });
    };

    fit = (): void => {
        this.scene?.fitToContent(60);
    };

    undo = (): void => {
        this.history.undo();
    };

    redo = (): void => {
        this.history.redo();
    };

    /** Points the vertex tool at the selected polygon — the "edit" of add/edit/remove. */
    reshapeSelected = (): void => {
        const polygon = this.selection.single;
        if (!(polygon instanceof PolygonObject)) return;
        this.tools?.activate('vertex-edit');
        this.vertexTool?.setTarget(polygon);
    };

    /**
     * Attaches the selected polygon to a location.
     *
     * A polygon drawn with the draw tool belongs to nothing until this is called. Assigning
     * replaces whatever shape that location had, because a location has exactly one — which is
     * what "redraw this location" means.
     */
    assignSelectedPolygonTo = (locationId: string): void => {
        const polygon = this.selection.single;
        if (!(polygon instanceof PolygonObject) || !this.scene) return;

        const previous = this.scene
            .all()
            .find(
                (object): object is PolygonObject =>
                    object instanceof PolygonObject &&
                    object !== polygon &&
                    object.getMeta<string>(META_LOCATION) === locationId
            );
        if (previous) this.scene.remove(previous);

        const location = this.locations.find((candidate) => candidate.id === locationId);
        polygon.setMeta(META_LOCATION, locationId);
        polygon.label = location?.name ?? locationId;

        runInAction(() => {
            this.selectedLocationId = locationId;
            this.hasUnassignedPolygon = false;
            this.dirtyLocationIds = new Set(this.dirtyLocationIds).add(locationId);
        });
    };

    /* ------------------------------------------------------------------- save */

    /**
     * Writes everything that changed.
     *
     * Locations and the map are separate requests because they are separate files (§4.2/§4.3),
     * and only dirty locations are written — otherwise one brush stroke rewrites every location
     * file in the story. Each carries the `If-Match` from when it was read; a `409` is surfaced
     * rather than retried, because the right answer to "someone else edited this" is to look.
     */
    save = async (): Promise<void> => {
        if (!this.scene || this.saving) return;
        runInAction(() => (this.saving = true));

        try {
            const polygons = this.scene
                .all()
                .filter((object): object is PolygonObject => object instanceof PolygonObject);

            for (const locationId of [...this.dirtyLocationIds]) {
                const polygon = polygons.find((object) => object.getMeta<string>(META_LOCATION) === locationId);

                const updated = await this.agent.updateLocationShape(
                    locationId,
                    polygon
                        ? {
                              mapId: this.map.id,
                              // Integers: a polygon vertex is a place on a map, and sub-pixel
                              // precision is diff noise the author has to read.
                              points: polygon.points.map((point) => ({
                                  x: Math.round(point.x),
                                  y: Math.round(point.y),
                              })),
                              color: polygon.color,
                              z: polygon.z === 0 ? undefined : polygon.z,
                          }
                        : // No polygon left for a dirty location means it was deleted; `null`
                          // takes the location off the map rather than leaving a stale shape.
                          null,
                    this.locationHashes.get(locationId) ?? undefined
                );
                this.locationHashes.set(locationId, updated.hash);
            }

            if (this.mapDirty) {
                const strokes = this.scene
                    .all()
                    .filter((object): object is BrushStroke => object instanceof BrushStroke)
                    .map((object) => ({
                        id: object.getMeta<string>(META_STROKE) ?? object.id.replace(/^stroke-/, ''),
                        color: object.color,
                        width: Math.round(object.width),
                        // Already rounded and simplified by `BrushStroke.finish` on pointer-up
                        // (§4.3); rounding again is cheap and keeps the contract local.
                        points: [...object.points].map((value) => Math.round(value)),
                    }));

                const notes = this.scene
                    .all()
                    // `layer === 'content'` is the filter that matters: a note the author is
                    // still typing lives on `overlay` until it is committed (see `NoteTool`),
                    // and an uncommitted placeholder must never reach `data/`.
                    .filter(
                        (object): object is NoteObject => object instanceof NoteObject && object.layer === 'content'
                    )
                    .map((object) => ({
                        id: object.getMeta<string>(META_NOTE) ?? object.id.replace(/^note-/, ''),
                        text: object.text,
                        position: { x: Math.round(object.position.x), y: Math.round(object.position.y) },
                        rotation: object.rotation === 0 ? undefined : object.rotation,
                        color: object.color,
                    }));

                const updated = await this.agent.updateMap(this.map.id, { strokes, notes }, this.mapHash ?? undefined);
                this.mapHash = updated.hash;
            }

            runInAction(() => {
                this.dirtyLocationIds = new Set();
                this.mapDirty = false;
            });
            showToast(_('Map saved'), { variant: 'success' });
        } catch (error) {
            showToast(error instanceof Error ? error.message : _('Failed to save the map'), { variant: 'error' });
        } finally {
            runInAction(() => (this.saving = false));
        }
    };
}
