import { nearestEdge, nearestVertex } from '../geometry';
import type { ISceneInteraction, Scene, TScenePointerEvent } from '../Scene';
import { PolygonShape } from '../shapes/PolygonShape';
import type { TPoint } from '../types';
import type { SelectionController } from './SelectionController';

export type TVertexEditOptions = {
    /** Vertex handle radius in screen px. Default 5. */
    handleRadius?: number;
    /** Which gesture on an edge inserts a vertex. Default `dblclick`. */
    insertOn?: 'click' | 'dblclick' | 'both';
    /** Vertices a polygon keeps at least. Default 3. */
    minVertices?: number;
    /** Handle colors. */
    handleFill?: string;
    handleStroke?: string;
    /** Snap/limit a dragged vertex. */
    constrainVertex?: (p: TPoint, index: number, shape: PolygonShape) => TPoint;
    /** Must beat the selection controller. Default 10. */
    priority?: number;
};

/**
 * Edits the vertices of the selected `PolygonShape` (while the scene is editable and the
 * polygon's `vertexEditable` is true): drag a handle to move a vertex, click/double-click an
 * edge to insert one, right-click a handle to remove one. Emits `change` with
 * `vertex-move` / `vertex-add` / `vertex-remove`.
 */
export class VertexEditController implements ISceneInteraction {
    readonly priority: number;
    private readonly options: Required<Omit<TVertexEditOptions, 'priority' | 'constrainVertex'>> &
        Pick<TVertexEditOptions, 'constrainVertex'>;
    private drag: {
        shape: PolygonShape;
        index: number;
        startWorld: TPoint;
        startVertex: TPoint;
        changed: boolean;
    } | null = null;
    private readonly dispose: () => void;

    constructor(
        readonly scene: Scene,
        readonly selection: SelectionController,
        options: TVertexEditOptions = {}
    ) {
        this.priority = options.priority ?? 10;
        this.options = {
            handleRadius: options.handleRadius ?? 5,
            insertOn: options.insertOn ?? 'dblclick',
            minVertices: options.minVertices ?? 3,
            handleFill: options.handleFill ?? '#fff',
            handleStroke: options.handleStroke ?? '#4da3ff',
            constrainVertex: options.constrainVertex,
        };
        this.dispose = scene.addInteraction(this);
    }

    destroy(): void {
        this.dispose();
    }

    /** The polygon currently being edited, or null. */
    get target(): PolygonShape | null {
        const s = this.selection.selected;
        if (!this.scene.editable || !(s instanceof PolygonShape) || !s.vertexEditable || !s.visible) return null;
        return this.scene.has(s) ? s : null;
    }

    private vertexAt(p: TPoint): number {
        const t = this.target;
        if (!t) return -1;
        const r = (this.options.handleRadius + 2) / this.scene.camera.zoom;
        return nearestVertex(p, t.points, r);
    }

    private edgeAt(p: TPoint, tolerance: number) {
        const t = this.target;
        if (!t) return null;
        const e = nearestEdge(p, t.points);
        return e && e.distance <= tolerance ? e : null;
    }

    private insertAt(e: TScenePointerEvent): boolean {
        const t = this.target;
        if (!t || this.vertexAt(e.world) >= 0) return false;
        const edge = this.edgeAt(e.world, e.tolerance);
        if (!edge) return false;
        const index = edge.index + 1;
        t.insertVertex(index, edge.point);
        this.scene.events.emit('change', { shape: t, kind: 'vertex-add', final: true, vertexIndex: index });
        return true;
    }

    onPointerDown(e: TScenePointerEvent): boolean {
        const t = this.target;
        const index = this.vertexAt(e.world);
        if (!t || index < 0) return false;
        this.drag = { shape: t, index, startWorld: e.world, startVertex: { ...t.points[index] }, changed: false };
        return true;
    }

    onPointerMove(e: TScenePointerEvent): void {
        const d = this.drag;
        if (!d) return;
        // Move by the pointer's delta, not to the pointer: grabbing a handle off-centre must not snap it.
        const moved = {
            x: d.startVertex.x + e.world.x - d.startWorld.x,
            y: d.startVertex.y + e.world.y - d.startWorld.y,
        };
        const p = this.options.constrainVertex ? this.options.constrainVertex(moved, d.index, d.shape) : moved;
        const before = d.shape.points[d.index];
        if (before && before.x === p.x && before.y === p.y) return;
        d.shape.moveVertex(d.index, p);
        d.changed = true;
        this.scene.events.emit('change', { shape: d.shape, kind: 'vertex-move', final: false, vertexIndex: d.index });
    }

    onPointerUp(): void {
        const d = this.drag;
        this.drag = null;
        if (d?.changed) {
            this.scene.events.emit('change', {
                shape: d.shape,
                kind: 'vertex-move',
                final: true,
                vertexIndex: d.index,
            });
        }
    }

    onClick(e: TScenePointerEvent): boolean {
        const t = this.target;
        if (!t) return false;
        // A click on a handle keeps the polygon selected instead of reaching the selection controller.
        if (this.vertexAt(e.world) >= 0) return true;
        if (this.options.insertOn === 'dblclick') return false;
        return this.insertAt(e);
    }

    onDoubleClick(e: TScenePointerEvent): boolean {
        if (!this.target) return false;
        if (this.vertexAt(e.world) >= 0) return true; // don't fire `action` from a handle
        if (this.options.insertOn === 'click') return false;
        return this.insertAt(e);
    }

    onContextMenu(e: TScenePointerEvent): boolean {
        const t = this.target;
        const index = this.vertexAt(e.world);
        if (!t || index < 0) return false;
        if (t.points.length > this.options.minVertices) {
            t.removeVertex(index);
            this.scene.events.emit('change', { shape: t, kind: 'vertex-remove', final: true, vertexIndex: index });
        }
        return true;
    }

    getCursor(e: TScenePointerEvent): string | undefined {
        if (!this.target) return undefined;
        if (this.vertexAt(e.world) >= 0) return 'grab';
        if (this.edgeAt(e.world, e.tolerance)) return 'copy';
        return undefined;
    }

    drawOverlay(ctx: CanvasRenderingContext2D, scene: Scene): void {
        const t = this.target;
        if (!t) return;
        const zoom = scene.camera.zoom;
        const r = this.options.handleRadius / zoom;
        ctx.save();
        ctx.setLineDash([]);
        ctx.fillStyle = this.options.handleFill;
        ctx.strokeStyle = this.options.handleStroke;
        ctx.lineWidth = 1.5 / zoom;
        for (const p of t.points) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }
}
