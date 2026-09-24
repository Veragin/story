import type { TBBox, TColor, TPoint } from '@story/shared';
import { bbox, distanceToSegment, expandBBox } from '../geometry/polygon';
import { fromFlatPoints, simplify, toFlatPoints } from '../geometry/simplify';
import type { TDrawSpec } from '../renderer/types';
import { SceneObject, type TSceneObjectJSON, type TSceneObjectOptions } from '../scene/SceneObject';

/**
 * One freehand stroke: a colour, a width and a run of points
 * (VISUALIZER_PLAN §3.2, §4.3).
 *
 * ## Size is the design constraint
 *
 * §4.3 is blunt that brush strokes are "the one place where 'everything in TypeScript' costs
 * something", and names three mitigations. Two of them live here:
 *
 *  - **Flat `number[]`**, not `TPoint[]`. Roughly half the characters of the equivalent object
 *    array, and Konva's native `Line.points` format, so nothing converts on the draw path.
 *  - **Round, then simplify, on pointer-up** — `finish()`. Coordinates become integers and
 *    Ramer–Douglas–Peucker throws away the points that carry no shape, *before* the stroke is
 *    ever handed to the server. Simplifying at save time instead would mean the map silently
 *    changed shape on the next reload.
 *
 * The third — the server's `413` above a size budget — is Phase 5's, because it is a policy
 * about a file, not about a shape.
 */

export type TBrushStrokeOptions = TSceneObjectOptions & {
    /** Flat `[x, y, …]`, in world units. */
    points?: number[];
    color?: TColor;
    /** World units. A stroke is part of the map, so it scales with it. */
    width?: number;
    selected?: boolean;
    /** Konva spline tension. Above 0 the stroke reads as a curve rather than a polyline. */
    tension?: number;
};

export type TBrushStrokeJSON = TSceneObjectJSON & {
    points: number[];
    color: TColor;
    width: number;
};

/** §4.3's stated epsilon: one world unit. */
export const DEFAULT_SIMPLIFY_EPSILON = 1;

export class BrushStroke extends SceneObject {
    readonly type = 'brush-stroke';

    private _points: number[];
    private _color: TColor;
    private _width: number;
    private _selected: boolean;
    private readonly tension: number;

    constructor(options: TBrushStrokeOptions) {
        super(options);
        this._points = options.points ? [...options.points] : [];
        this._color = options.color ?? '#ffffff';
        this._width = options.width ?? 4;
        this._selected = options.selected ?? false;
        this.tension = options.tension ?? 0.4;
    }

    /** Flat `[x, y, …]`. */
    get points(): readonly number[] {
        return this._points;
    }

    set points(value: readonly number[]) {
        this._points = [...value];
        this.notify('points');
    }

    get pointCount(): number {
        return Math.floor(this._points.length / 2);
    }

    /**
     * Appends one sample. Called on every pointer-move while the button is held, so it mutates
     * in place: allocating a new array per sample would garbage a few hundred arrays per stroke.
     */
    addPoint(point: TPoint): void {
        this._points.push(point.x, point.y);
        this.notify('points');
    }

    /**
     * Ends the stroke: round to integers, then simplify. Returns how many points survived, so a
     * caller can drop a stroke that turned out to be a single click.
     *
     * Idempotent — running it twice on an already-finished stroke changes nothing, because
     * rounding integers and simplifying an already-simplified run are both fixed points.
     */
    finish(epsilon = DEFAULT_SIMPLIFY_EPSILON): number {
        const rounded = fromFlatPoints(this._points).map((point) => ({
            x: Math.round(point.x),
            y: Math.round(point.y),
        }));

        // Consecutive duplicates are dropped *before* simplification. Rounding creates them
        // wholesale — any two samples inside the same world unit collapse onto each other — and
        // RDP keeps both endpoints of a run unconditionally, so a stroke that never moved would
        // otherwise survive as two identical points and be persisted as an invisible,
        // unclickable stroke in `data/`.
        const deduped: typeof rounded = [];
        for (const point of rounded) {
            const last = deduped[deduped.length - 1];
            if (last && last.x === point.x && last.y === point.y) continue;
            deduped.push(point);
        }

        this._points = toFlatPoints(simplify(deduped, epsilon));
        this.notify('points');
        return this.pointCount;
    }

    get color(): TColor {
        return this._color;
    }
    set color(value: TColor) {
        if (value === this._color) return;
        this._color = value;
        this.notify('color');
    }

    get width(): number {
        return this._width;
    }
    set width(value: number) {
        this._width = value;
        this.notify('width');
    }

    get selected(): boolean {
        return this._selected;
    }
    set selected(value: boolean) {
        if (value === this._selected) return;
        this._selected = value;
        this.notify('selected');
    }

    /** Bounds include half the stroke width, since the line is drawn centred on its points. */
    get bounds(): TBBox {
        const box = bbox(fromFlatPoints(this._points));
        return expandBBox(box, this._width / 2);
    }

    /**
     * Distance to the polyline, not the bounding box — a long diagonal stroke's box is mostly
     * empty, and clicking that empty space must not select it.
     */
    hitTest(world: TPoint, tolerance = 0): boolean {
        if (!this.visible) return false;
        const points = fromFlatPoints(this._points);
        if (points.length === 0) return false;
        const reach = this._width / 2 + tolerance;
        if (points.length === 1) return Math.hypot(world.x - points[0].x, world.y - points[0].y) <= reach;

        for (let i = 0; i + 1 < points.length; i++) {
            if (distanceToSegment(world, points[i], points[i + 1]) <= reach) return true;
        }
        return false;
    }

    translate(delta: TPoint): void {
        for (let i = 0; i + 1 < this._points.length; i += 2) {
            this._points[i] += delta.x;
            this._points[i + 1] += delta.y;
        }
        this.notify('points');
    }

    toSpec(): TDrawSpec {
        return {
            kind: 'line',
            points: this._points,
            stroke: this._selected ? '#ffffff' : this._color,
            strokeWidth: this._width,
            // World-scaled, unlike every outline in this package: a brush stroke *is* map
            // content, so it has to zoom with the map rather than stay a constant pixel width.
            strokeScaleEnabled: true,
            lineCap: 'round',
            lineJoin: 'round',
            tension: this.tension,
        };
    }

    toJSON(): TBrushStrokeJSON {
        return {
            ...super.toJSON(),
            points: [...this._points],
            color: this._color,
            width: this._width,
        };
    }

    static fromJSON(json: TBrushStrokeJSON): BrushStroke {
        const stroke = new BrushStroke({
            id: json.id,
            points: json.points,
            color: json.color,
            width: json.width,
        });
        stroke.applyBaseJSON(json);
        return stroke;
    }
}
