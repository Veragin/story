import type { TBBox, TColor, TPoint } from '@story/shared';
import { bboxFromCorners, distanceToSegment, expandBBox } from '../geometry/polygon';
import type { TDrawSpec } from '../renderer/types';
import { SceneObject, type TSceneObjectJSON, type TSceneObjectOptions } from '../scene/SceneObject';

/**
 * An arrow from one scene object to another — a passage link, a chapter's child
 * (VISUALIZER_PLAN §3.2).
 *
 * **Side-aware anchoring**: the arrow is clipped to each endpoint's bounding box rather than
 * drawn centre-to-centre, so the head lands *on* the target's border instead of underneath it.
 * That is what `Graphs/EdgeFromSide.ts` did in the old engine, expressed here as a ray/box
 * intersection so it holds for any aspect ratio and needs no per-side branching.
 *
 * The endpoints are **live object references**, not copied coordinates: dragging a passage has
 * to move its arrows, and an edge that cached its endpoints would need invalidating from the
 * outside on every frame of the drag.
 */

export type TEdgeObjectOptions = TSceneObjectOptions & {
    source: SceneObject;
    target: SceneObject;
    color?: TColor;
    width?: number;
    dashed?: boolean;
    label?: string;
    selected?: boolean;
    /** Extra world-unit gap between the arrowhead and the target's border. */
    gap?: number;
    /** Pixel size of the arrowhead. Screen units, so it does not balloon when zoomed in. */
    pointerLength?: number;
};

export type TEdgeObjectJSON = TSceneObjectJSON & {
    sourceId: string;
    targetId: string;
    color: TColor;
    width: number;
    dashed: boolean;
    label?: string;
};

const DEFAULT_COLOR = '#7f8fa6';
const SELECTED_COLOR = '#ffffff';

export class EdgeObject extends SceneObject {
    readonly type = 'edge';

    private _source: SceneObject;
    private _target: SceneObject;
    private _color: TColor;
    private _width: number;
    private _dashed: boolean;
    private _label?: string;
    private _selected: boolean;
    private readonly gap: number;
    private readonly pointerLength: number;

    constructor(options: TEdgeObjectOptions) {
        // An edge is not draggable: it has no position of its own, only two endpoints.
        super({ ...options, draggable: options.draggable ?? false });
        this._source = options.source;
        this._target = options.target;
        this._color = options.color ?? DEFAULT_COLOR;
        this._width = options.width ?? 1.5;
        this._dashed = options.dashed ?? false;
        this._label = options.label;
        this._selected = options.selected ?? false;
        this.gap = options.gap ?? 2;
        this.pointerLength = options.pointerLength ?? 9;
    }

    get source(): SceneObject {
        return this._source;
    }
    set source(value: SceneObject) {
        this._source = value;
        this.notify('source');
    }

    get target(): SceneObject {
        return this._target;
    }
    set target(value: SceneObject) {
        this._target = value;
        this.notify('target');
    }

    get color(): TColor {
        return this._color;
    }
    set color(value: TColor) {
        if (value === this._color) return;
        this._color = value;
        this.notify('color');
    }

    get dashed(): boolean {
        return this._dashed;
    }
    set dashed(value: boolean) {
        this._dashed = value;
        this.notify('dashed');
    }

    get label(): string | undefined {
        return this._label;
    }
    set label(value: string | undefined) {
        this._label = value;
        this.notify('label');
    }

    get selected(): boolean {
        return this._selected;
    }
    set selected(value: boolean) {
        if (value === this._selected) return;
        this._selected = value;
        this.notify('selected');
    }

    /** True when both ends are the same object — drawn as a self-loop, not a zero-length line. */
    get isSelfLoop(): boolean {
        return this._source === this._target;
    }

    /** The two points the arrow is actually drawn between, clipped to each endpoint's border. */
    get anchors(): { from: TPoint; to: TPoint } {
        const sourceCenter = boxCenter(this._source.bounds);
        const targetCenter = boxCenter(this._target.bounds);

        if (this.isSelfLoop) {
            // A loop leaves and re-enters the top edge, offset sideways so it is visible.
            const box = this._source.bounds;
            const width = box.max.x - box.min.x;
            return {
                from: { x: box.min.x + width * 0.3, y: box.min.y },
                to: { x: box.min.x + width * 0.7, y: box.min.y },
            };
        }

        return {
            from: clipToBox(sourceCenter, targetCenter, this._source.bounds, 0),
            to: clipToBox(targetCenter, sourceCenter, this._target.bounds, this.gap),
        };
    }

    get bounds(): TBBox {
        const { from, to } = this.anchors;
        return bboxFromCorners(from, to);
    }

    /** An edge is a line, so its hit test is distance-to-segment rather than its bounding box. */
    hitTest(world: TPoint, tolerance = 0): boolean {
        if (!this.visible) return false;
        const { from, to } = this.anchors;
        return distanceToSegment(world, from, to) <= Math.max(tolerance, this._width);
    }

    /** An edge has no position to translate — it follows its endpoints. */
    translate(): void {
        /* intentionally empty */
    }

    toSpec(): TDrawSpec {
        const { from, to } = this.anchors;
        const color = this._selected ? SELECTED_COLOR : this._color;

        const children: TDrawSpec[] = [
            {
                kind: 'arrow',
                points: [from.x, from.y, to.x, to.y],
                stroke: color,
                fill: color,
                strokeWidth: this._selected ? this._width + 1 : this._width,
                strokeScaleEnabled: false,
                dash: this._dashed ? [6, 5] : undefined,
                pointerLength: this.pointerLength,
                pointerWidth: this.pointerLength * 0.8,
                lineCap: 'round',
            },
        ];

        if (this._label) {
            children.push({
                kind: 'text',
                position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
                text: this._label,
                fontSize: 11,
                fill: color,
                centered: true,
            });
        }

        return { kind: 'group', children };
    }

    toJSON(): TEdgeObjectJSON {
        return {
            ...super.toJSON(),
            sourceId: this._source.id,
            targetId: this._target.id,
            color: this._color,
            width: this._width,
            dashed: this._dashed,
            label: this._label,
        };
    }

    /**
     * Rebuilds an edge from JSON. Endpoints are ids on disk and objects in memory, so the
     * caller supplies the lookup — the edge cannot resolve them itself without knowing about
     * the scene, which would be a cycle.
     */
    static fromJSON(json: TEdgeObjectJSON, resolve: (id: string) => SceneObject | undefined): EdgeObject | null {
        const source = resolve(json.sourceId);
        const target = resolve(json.targetId);
        if (!source || !target) return null;

        const edge = new EdgeObject({
            id: json.id,
            source,
            target,
            color: json.color,
            width: json.width,
            dashed: json.dashed,
            label: json.label,
        });
        edge.applyBaseJSON(json);
        return edge;
    }
}

const boxCenter = (box: TBBox): TPoint => ({
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
});

/**
 * Walks from `center` toward `toward` and returns where the ray leaves `box`, pushed out by
 * `gap`. This is the side-aware anchoring: the result is on whichever edge the ray actually
 * crosses, with no need to ask which side that was.
 *
 * Falls back to the centre for a degenerate box or a zero-length ray — both of which happen
 * transiently while an object is being created.
 */
const clipToBox = (center: TPoint, toward: TPoint, box: TBBox, gap: number): TPoint => {
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;
    if (dx === 0 && dy === 0) return center;

    const halfWidth = (box.max.x - box.min.x) / 2;
    const halfHeight = (box.max.y - box.min.y) / 2;
    if (halfWidth <= 0 && halfHeight <= 0) return center;

    // How far along the ray each axis's boundary lies; the nearer one is the edge it crosses.
    const scaleX = dx === 0 ? Infinity : halfWidth / Math.abs(dx);
    const scaleY = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
    const scale = Math.min(scaleX, scaleY);
    if (!Number.isFinite(scale)) return center;

    const length = Math.hypot(dx, dy);
    const gapScale = length === 0 ? 0 : gap / length;
    const total = scale + gapScale;

    return { x: center.x + dx * total, y: center.y + dy * total };
};

/** Exported for the marquee: an edge's selectable area is its line, not its bounding box. */
export const edgeHitBox = (edge: EdgeObject, tolerance: number): TBBox => expandBBox(edge.bounds, tolerance);
