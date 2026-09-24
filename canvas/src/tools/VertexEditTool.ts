import { Observer, type TPoint } from '@story/shared';
import { SnapshotCommand } from '../history/History';
import { PolygonObject } from '../objects/PolygonObject';
import type { TKeyEvent, TPointerEvent } from '../renderer/types';
import { BaseTool } from './Tool';
import { VertexHandlesObject } from './VertexHandlesObject';

/**
 * Reshapes a polygon: drag a vertex, alt-click to delete one, click an edge midpoint to insert
 * (VISUALIZER_PLAN §3.2 `tools/VertexEditTool.ts`).
 *
 * §2 is explicit that this is the thing Konva does not ship — its `Transformer` scales and
 * rotates a shape, it does not move a shape's points — and it is most of why the plan chose a
 * rendering library over an editor framework. All of the picking below is `@story/canvas`
 * geometry in world units, so it behaves identically under the fake renderer and is testable.
 *
 * ## Pick tolerances are screen-derived
 *
 * A handle is drawn at a fixed pixel radius (`VertexHandlesObject`), so the distance at which
 * the author can grab it must be a fixed pixel radius too — converted to world units at the
 * current zoom on every pick. A world-unit tolerance would make handles ungrabbable when
 * zoomed out and grab the wrong one when zoomed in.
 */

const VERTEX_PICK_PX = 8;
const EDGE_PICK_PX = 8;

export type TVertexEditToolOptions = {
    /** Restricts which polygons this tool will edit. */
    filter?: (polygon: PolygonObject) => boolean;
};

export type TVertexChange = {
    polygon: PolygonObject;
    reason: 'move' | 'insert' | 'remove';
};

type TDragState = {
    polygon: PolygonObject;
    index: number;
    before: TPoint[];
};

export class VertexEditTool extends BaseTool {
    readonly name = 'vertex-edit';
    readonly cursor = 'default';

    /** Fires after each committed edit, so a store can persist the new ring. */
    readonly onChanged = new Observer<TVertexChange>();

    private readonly filter?: (polygon: PolygonObject) => boolean;

    private target: PolygonObject | null = null;
    private handles: VertexHandlesObject | null = null;
    private drag: TDragState | null = null;

    constructor(options: TVertexEditToolOptions = {}) {
        super();
        this.filter = options.filter;
    }

    protected onActivate(): void {
        // Adopt whatever is already selected, so "select a shape, press the reshape button"
        // works without a second click.
        const single = this.selection.single;
        if (single instanceof PolygonObject && this.canEdit(single)) this.setTarget(single);
    }

    protected onCancel(): void {
        if (this.drag) {
            // Put the ring back: a cancelled vertex drag must not leave the shape deformed.
            this.drag.polygon.setPointsRaw(this.drag.before);
            this.drag.polygon.transient = false;
            this.drag = null;
        }
        this.target = null;
        this.handles = null;
    }

    /** The polygon whose handles are showing. */
    get editing(): PolygonObject | null {
        return this.target;
    }

    /** Points the handles at a polygon, or clears them with `null`. */
    setTarget(polygon: PolygonObject | null): void {
        this.clearOverlay();
        this.target = polygon;
        this.handles = null;
        if (!polygon) return;

        this.handles = this.addOverlay(new VertexHandlesObject({ id: `vertex-handles-${polygon.id}` }, polygon.points));
        this.selection.set([polygon]);
    }

    onPointerDown(event: TPointerEvent): boolean | void {
        const vertexTolerance = this.screenToWorld(VERTEX_PICK_PX);

        if (this.target) {
            const index = this.target.findVertex(event.world, vertexTolerance);

            if (index >= 0) {
                if (event.altKey) {
                    this.removeVertex(this.target, index);
                    return true;
                }
                this.drag = {
                    polygon: this.target,
                    index,
                    before: this.target.points.map((point) => ({ ...point })),
                };
                this.target.transient = true;
                this.handles?.setActiveIndex(index);
                return true;
            }

            // Not on a vertex: is it on an edge midpoint, or near the outline? Either inserts.
            const edge = this.target.nearestEdge(event.world);
            if (edge.distance <= this.screenToWorld(EDGE_PICK_PX)) {
                this.insertVertex(this.target, edge.edgeIndex, edge.point);
                return true;
            }
        }

        // Nothing on the current target: adopt whichever polygon was clicked, or clear.
        const hit = this.scene.hitTest(
            event.world,
            (object) => object instanceof PolygonObject && this.canEdit(object)
        );
        this.setTarget(hit instanceof PolygonObject ? hit : null);
        return true;
    }

    onPointerMove(event: TPointerEvent): boolean | void {
        if (this.drag) {
            const point = event.altKey
                ? event.world
                : this.snapping.snap(event.world, this.snapCandidates(this.drag.polygon)).point;
            this.drag.polygon.moveVertex(this.drag.index, point);
            this.handles?.setPoints(this.drag.polygon.points);
            return true;
        }

        if (!this.target) return;

        // Cursor feedback: which of the three things a click here would do.
        const index = this.target.findVertex(event.world, this.screenToWorld(VERTEX_PICK_PX));
        this.handles?.setActiveIndex(index);
        if (index >= 0) {
            this.scene.setCursor(event.altKey ? 'not-allowed' : 'move');
            return true;
        }

        const edge = this.target.nearestEdge(event.world);
        this.scene.setCursor(edge.distance <= this.screenToWorld(EDGE_PICK_PX) ? 'copy' : this.cursor);
        return;
    }

    onPointerUp(): boolean | void {
        if (!this.drag) return;

        const { polygon, before } = this.drag;
        polygon.transient = false;
        // Normalise once, at the end: re-winding mid-drag would reverse the array under the
        // index being held and the author would find themselves dragging a different corner.
        polygon.normalize();
        const after = polygon.points.map((point) => ({ ...point }));

        this.drag = null;
        this.handles?.setPoints(polygon.points);
        this.handles?.setActiveIndex(-1);

        if (samePoints(before, after)) return true;

        this.history.record(
            new SnapshotCommand<TPoint[]>('Move vertex', `vertices:${polygon.id}`, before, after, (points) => {
                polygon.setPointsRaw(points);
                this.handles?.setPoints(points);
            })
        );
        this.onChanged.notify({ polygon, reason: 'move' });
        return true;
    }

    onKeyDown(event: TKeyEvent): boolean | void {
        if (event.key === 'Escape' && (this.drag || this.target)) {
            event.preventDefault();
            this.cancel();
            return true;
        }
        return;
    }

    private insertVertex(polygon: PolygonObject, edgeIndex: number, point: TPoint): void {
        const before = polygon.points.map((p) => ({ ...p }));
        polygon.insertVertex(edgeIndex, point);
        const after = polygon.points.map((p) => ({ ...p }));
        this.handles?.setPoints(polygon.points);

        this.history.record(
            new SnapshotCommand<TPoint[]>('Insert vertex', `vertices:${polygon.id}:insert`, before, after, (points) => {
                polygon.setPointsRaw(points);
                this.handles?.setPoints(points);
            })
        );
        this.onChanged.notify({ polygon, reason: 'insert' });
    }

    private removeVertex(polygon: PolygonObject, index: number): void {
        const before = polygon.points.map((p) => ({ ...p }));
        // Refused below three vertices — `PolygonObject.removeVertex` owns that rule, because a
        // two-point ring cannot be hit-tested and the author could not get it back.
        if (!polygon.removeVertex(index)) return;
        const after = polygon.points.map((p) => ({ ...p }));
        this.handles?.setPoints(polygon.points);
        this.handles?.setActiveIndex(-1);

        this.history.record(
            new SnapshotCommand<TPoint[]>('Delete vertex', `vertices:${polygon.id}:remove`, before, after, (points) => {
                polygon.setPointsRaw(points);
                this.handles?.setPoints(points);
            })
        );
        this.onChanged.notify({ polygon, reason: 'remove' });
    }

    /** Other polygons' vertices, so a reshaped border can be snapped flush to its neighbour. */
    private snapCandidates(exclude: PolygonObject): TPoint[] {
        const candidates: TPoint[] = [];
        for (const object of this.scene.all()) {
            if (object === exclude) continue;
            if (object instanceof PolygonObject) candidates.push(...object.points);
        }
        return candidates;
    }

    private screenToWorld(pixels: number): number {
        return this.scene.viewport.screenLengthToWorld(pixels);
    }

    private canEdit(polygon: PolygonObject): boolean {
        return this.filter ? this.filter(polygon) : true;
    }
}

const samePoints = (a: readonly TPoint[], b: readonly TPoint[]): boolean =>
    a.length === b.length && a.every((point, i) => point.x === b[i].x && point.y === b[i].y);
