import { reaction } from 'mobx';
import { PolygonShape, SelectionController, VertexEditController, type Scene, type Shape } from '../../canvas';
import { locationColor, locationStyle, type MapPageStore } from './MapPageStore';

export type TLocationShapeData = { locationId: string };

const LAYER = 'locations';

/**
 * The Locations layer: one `PolygonShape` per `map.locations` entry, on a transparent `Scene`
 * that sits over the tiles canvas and shares its camera.
 *
 *  - `view`: not editable, double-click opens the location modal;
 *  - `locations`: select, drag, edit vertices (Canvas library), double-click opens the modal;
 *  - `tiles`: the layer is hidden and the scene canvas lets pointer events through to the tiles.
 *
 * Shape edits go back to the store on the final `change` event; store changes (load, live refresh,
 * colour, add, delete) are synced into the scene by a MobX reaction.
 */
export class LocationsLayer {
    readonly selection: SelectionController;
    private readonly vertexEdit: VertexEditController;
    private readonly shapes = new Map<string, PolygonShape<TLocationShapeData>>();
    private readonly disposers: (() => void)[] = [];

    constructor(
        readonly scene: Scene,
        private readonly store: MapPageStore,
        private readonly onOpen: (locationId: string) => void
    ) {
        scene.layer(LAYER, 1);
        this.selection = new SelectionController(scene);
        this.vertexEdit = new VertexEditController(scene, this.selection);

        this.disposers.push(
            scene.events.on('change', ({ shape, final }) => {
                const id = locationIdOf(shape);
                if (final && id && shape instanceof PolygonShape) store.setLocationPolygon(id, shape.points);
            }),
            scene.events.on('select', ({ shape }) => {
                const id = shape ? locationIdOf(shape) : null;
                if (id !== store.selectedLocationId) store.selectLocation(id ?? null);
            }),
            scene.events.on('action', ({ shape }) => {
                const id = locationIdOf(shape);
                if (id && store.mode !== 'tiles') this.onOpen(id);
            }),
            reaction(
                () => [store.revision, store.mode, [...store.locations.values()].map((l) => l.version).join()],
                () => this.sync(),
                { fireImmediately: true }
            ),
            reaction(
                () => store.selectedLocationId,
                (id) => {
                    const shape = id ? (this.shapes.get(id) ?? null) : null;
                    if (shape !== this.selection.selected) this.selection.select(shape);
                },
                { fireImmediately: true }
            )
        );
    }

    /** Brings the scene in line with the store. */
    sync = () => {
        const { store, scene } = this;
        const mode = store.mode;
        scene.editable = mode === 'locations';
        scene.layer(LAYER).visible = mode !== 'tiles';
        scene.canvas.style.pointerEvents = mode === 'tiles' ? 'none' : 'auto';

        const defs = store.map?.locations ?? {};
        for (const [id, shape] of this.shapes) {
            if (!defs[id]) {
                scene.remove(shape);
                this.shapes.delete(id);
            }
        }
        for (const [id, def] of Object.entries(defs)) {
            const color = locationColor(id, def);
            const style = { ...locationStyle(color), ...(def.fill ? { fill: def.fill } : {}) };
            const missing = !store.locations.has(id);
            const props = {
                fill: style.fill,
                stroke: { color, width: 2, screenWidth: true, dash: missing ? [6, 4] : undefined },
                hoverStyle: { fill: `${color}88` },
                label: missing ? _('%s (no location file)', id) : store.locationName(id),
                labelStyle: { color: '#fff', fontSize: 16, fontWeight: 600 },
                draggable: mode === 'locations',
                cursor: 'pointer',
            };
            let shape = this.shapes.get(id);
            if (!shape) {
                shape = new PolygonShape<TLocationShapeData>({
                    id: `location:${id}`,
                    points: def.polygon,
                    data: { locationId: id },
                    ...props,
                });
                this.shapes.set(id, shape);
                scene.add(shape, LAYER);
            } else {
                if (!samePoints(shape.points, def.polygon)) shape.setPoints(def.polygon);
                shape.update(props);
            }
        }
        const selectedId = store.selectedLocationId;
        const selected = selectedId ? (this.shapes.get(selectedId) ?? null) : null;
        if (selected !== this.selection.selected && mode === 'locations') this.selection.select(selected);
    };

    getShape = (locationId: string) => this.shapes.get(locationId);

    destroy = () => {
        for (const d of this.disposers.splice(0)) d();
        this.vertexEdit.destroy();
        this.selection.destroy();
        for (const shape of this.shapes.values()) this.scene.remove(shape);
        this.shapes.clear();
    };
}

const locationIdOf = (shape: Shape): string | undefined => (shape.data as TLocationShapeData | undefined)?.locationId;

const samePoints = (a: { x: number; y: number }[], b: { x: number; y: number }[]) =>
    a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y);
