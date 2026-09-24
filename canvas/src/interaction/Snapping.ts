import type { TPoint } from '@story/shared';
import { distanceSq } from '../geometry/polygon';

/**
 * Snapping (VISUALIZER_PLAN §3.2 `interaction/Snapping.ts`).
 *
 * Everything here is in **world units**, per design rule 1 — including the thresholds. That is
 * the decision worth defending: a screen-pixel threshold would mean the same drag snaps at one
 * zoom and not at another, and a map drawn while zoomed out would have vertices that do not
 * quite meet when the author later zooms in. Callers that want a constant *feel* convert a
 * pixel threshold through `Viewport.screenLengthToWorld` before constructing this — which is
 * exactly what the tools do for vertex snapping, and deliberately do *not* do for the grid.
 */

export type TSnapOptions = {
    /** Grid spacing in world units. `0` disables grid snapping. */
    gridSize?: number;
    /** How close, in world units, a candidate vertex must be to win. */
    vertexThreshold?: number;
    /** How close the pointer must get to the first vertex to close a polygon. */
    closeThreshold?: number;
    /** Master switch — what the Shift key toggles while dragging. */
    enabled?: boolean;
};

export type TSnapResult = {
    point: TPoint;
    /** What it snapped to, so a tool can show the right guide. `'none'` means unchanged. */
    kind: 'none' | 'grid' | 'vertex';
    /** The candidate it snapped to, when `kind` is `'vertex'`. */
    target?: TPoint;
};

export class Snapping {
    gridSize: number;
    vertexThreshold: number;
    closeThreshold: number;
    enabled: boolean;

    constructor(options: TSnapOptions = {}) {
        this.gridSize = options.gridSize ?? 0;
        this.vertexThreshold = options.vertexThreshold ?? 8;
        this.closeThreshold = options.closeThreshold ?? 12;
        this.enabled = options.enabled ?? true;
    }

    /**
     * Snaps `point`, preferring a nearby vertex over the grid.
     *
     * The order matters and is not arbitrary: the author snapping a new location's corner to an
     * existing one means "these two places touch", which is information the grid does not have.
     * Letting the grid win would round that shared corner to two different cells.
     */
    snap(point: TPoint, candidates: readonly TPoint[] = []): TSnapResult {
        if (!this.enabled) return { point, kind: 'none' };

        const vertex = this.nearestVertex(point, candidates);
        if (vertex) return { point: { ...vertex }, kind: 'vertex', target: vertex };

        if (this.gridSize > 0) {
            return {
                point: {
                    x: Math.round(point.x / this.gridSize) * this.gridSize,
                    y: Math.round(point.y / this.gridSize) * this.gridSize,
                },
                kind: 'grid',
            };
        }

        return { point, kind: 'none' };
    }

    /** Grid only — for the cases where snapping to another shape would be wrong. */
    snapToGrid(point: TPoint): TPoint {
        if (!this.enabled || this.gridSize <= 0) return point;
        return {
            x: Math.round(point.x / this.gridSize) * this.gridSize,
            y: Math.round(point.y / this.gridSize) * this.gridSize,
        };
    }

    /** Nearest candidate within `vertexThreshold`, or `undefined`. */
    nearestVertex(point: TPoint, candidates: readonly TPoint[]): TPoint | undefined {
        if (!this.enabled || candidates.length === 0) return undefined;
        let best = this.vertexThreshold * this.vertexThreshold;
        let winner: TPoint | undefined;
        for (const candidate of candidates) {
            const d = distanceSq(point, candidate);
            if (d <= best) {
                best = d;
                winner = candidate;
            }
        }
        return winner;
    }

    /**
     * Is `point` near enough to `first` to close the ring being drawn?
     *
     * A separate, larger threshold than vertex snapping because closing is the *terminating*
     * action of the draw gesture: being slightly too strict means the author clicks again and
     * adds a stray vertex on top of the first one, which is the more annoying failure.
     *
     * `minimumVertices` guards the degenerate case — a double-click on the very first point
     * would otherwise "close" a one-point polygon.
     */
    shouldClose(point: TPoint, first: TPoint | undefined, vertexCount: number, minimumVertices = 3): boolean {
        if (!first || vertexCount < minimumVertices) return false;
        return distanceSq(point, first) <= this.closeThreshold * this.closeThreshold;
    }
}
