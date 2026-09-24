import type { TBBox, TColor, TPoint, TPolygon } from '@story/shared';
import {
    bbox,
    centroid,
    distanceToOutline,
    findVertexNear,
    isPointInPolygon,
    isSelfIntersecting,
    openRing,
    toClockwise,
    translatePolygon,
} from '../geometry/polygon';
import { toFlatPoints } from '../geometry/simplify';
import type { TDrawSpec } from '../renderer/types';
import { SceneObject, type TSceneObjectJSON, type TSceneObjectOptions } from '../scene/SceneObject';

/**
 * A closed polygon in world units — the Visualizer's central primitive (README: "location knows
 * its position by points of polygon mash shape"), and the thing the engine this replaces could
 * not express, since its `VisualObject` was `{position, size}` and every hit test was a box.
 *
 * Points are stored **open** (`TPolygon`: the closing edge is implicit) and the ring is
 * normalised to clockwise-on-canvas on every write. Both are so that `data/` only ever contains
 * one spelling of a given shape — otherwise the same polygon drawn in two directions produces
 * two different diffs, and `git` cannot tell the author they are the same location.
 */

export type TPolygonObjectOptions = TSceneObjectOptions & {
    points: TPolygon;
    color?: TColor;
    /** Outline colour. Defaults to `color` at full opacity. */
    stroke?: TColor;
    strokeWidth?: number;
    /** Fill opacity. The outline is always drawn opaque so a shape stays findable. */
    fillOpacity?: number;
    label?: string;
    labelColor?: TColor;
    /** Drawn with a highlight outline. The scene does not own selection; `Selection` does. */
    selected?: boolean;
};

export type TPolygonObjectJSON = TSceneObjectJSON & {
    points: TPoint[];
    color: TColor;
    stroke?: TColor;
    strokeWidth: number;
    fillOpacity: number;
    label?: string;
};

const DEFAULT_COLOR = '#4f7fd4';
const SELECTED_STROKE = '#ffffff';

/**
 * The stored form of a ring: open (no duplicated closing point) and clockwise on canvas.
 *
 * Both halves are about `data/` producing one spelling per shape. Winding is the obvious one;
 * the open/closed half matters just as much, because a caller handing in an explicitly-closed
 * ring — which is what most external formats produce — would otherwise leave a zero-length
 * final edge that every vertex tool would then offer the author a handle for.
 */
const normalizeRing = (points: TPolygon): TPoint[] => toClockwise(openRing(points));

export class PolygonObject extends SceneObject {
    readonly type = 'polygon';

    private _points: TPoint[];
    private _color: TColor;
    private _stroke?: TColor;
    private _strokeWidth: number;
    private _fillOpacity: number;
    private _label?: string;
    private _labelColor: TColor;
    private _selected: boolean;

    constructor(options: TPolygonObjectOptions) {
        super(options);
        this._points = normalizeRing(options.points);
        this._color = options.color ?? DEFAULT_COLOR;
        this._stroke = options.stroke;
        this._strokeWidth = options.strokeWidth ?? 2;
        this._fillOpacity = options.fillOpacity ?? 0.35;
        this._label = options.label;
        this._labelColor = options.labelColor ?? '#ffffff';
        this._selected = options.selected ?? false;
    }

    /* --------------------------------------------------------------- points */

    /** The ring, open and clockwise. Treat as immutable: mutate through `points = …`. */
    get points(): readonly TPoint[] {
        return this._points;
    }

    set points(value: TPolygon) {
        this._points = normalizeRing(value);
        this.notify('points');
    }

    /**
     * Replaces the ring *without* normalising the winding.
     *
     * A vertex drag passes through here: re-winding mid-gesture would reverse the array under
     * the index the tool is holding, and the author would find themselves dragging a different
     * corner. The tool normalises once, on pointer-up.
     */
    setPointsRaw(value: TPolygon): void {
        this._points = [...value];
        this.notify('points');
    }

    /** Normalises winding. Called by the draw and vertex tools when a gesture ends. */
    normalize(): void {
        this._points = normalizeRing(this._points);
        this.notify('points');
    }

    get vertexCount(): number {
        return this._points.length;
    }

    /** Moves one vertex. Out-of-range indices are ignored rather than growing the array. */
    moveVertex(index: number, point: TPoint): void {
        if (index < 0 || index >= this._points.length) return;
        this._points = this._points.map((existing, i) => (i === index ? { ...point } : existing));
        this.notify('points');
    }

    /** Inserts a vertex after `edgeIndex` — the index `distanceToOutline` reports. */
    insertVertex(edgeIndex: number, point: TPoint): void {
        const at = Math.min(Math.max(edgeIndex + 1, 0), this._points.length);
        this._points = [...this._points.slice(0, at), { ...point }, ...this._points.slice(at)];
        this.notify('points');
    }

    /**
     * Removes a vertex. Refuses below three, because a two-point "polygon" has no area, cannot
     * be hit-tested and cannot be recovered from by dragging — the author would have deleted the
     * location by removing one corner too many.
     */
    removeVertex(index: number): boolean {
        if (this._points.length <= 3) return false;
        if (index < 0 || index >= this._points.length) return false;
        this._points = this._points.filter((_, i) => i !== index);
        this.notify('points');
        return true;
    }

    /** Index of the vertex within `tolerance` world units, or `-1`. */
    findVertex(world: TPoint, tolerance: number): number {
        return findVertexNear(world, this._points, tolerance);
    }

    /** Nearest point on the outline, plus which edge — what edge-insertion needs. */
    nearestEdge(world: TPoint) {
        return distanceToOutline(world, this._points);
    }

    /** Area centroid, where the label sits. */
    get center(): TPoint {
        return centroid(this._points);
    }

    /**
     * True when two non-adjacent edges cross. Not enforced — the author is allowed to draw a
     * bad shape — but the draw tools surface it, because a self-intersecting ring renders with
     * an even-odd hole and its area stops meaning anything.
     */
    get selfIntersecting(): boolean {
        return isSelfIntersecting(this._points);
    }

    /* ------------------------------------------------------------ appearance */

    get color(): TColor {
        return this._color;
    }
    set color(value: TColor) {
        if (value === this._color) return;
        this._color = value;
        this.notify('color');
    }

    get stroke(): TColor | undefined {
        return this._stroke;
    }
    set stroke(value: TColor | undefined) {
        this._stroke = value;
        this.notify('stroke');
    }

    get strokeWidth(): number {
        return this._strokeWidth;
    }
    set strokeWidth(value: number) {
        this._strokeWidth = value;
        this.notify('strokeWidth');
    }

    get fillOpacity(): number {
        return this._fillOpacity;
    }
    set fillOpacity(value: number) {
        this._fillOpacity = value;
        this.notify('fillOpacity');
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

    /* ---------------------------------------------------------- SceneObject */

    get bounds(): TBBox {
        return bbox(this._points);
    }

    /**
     * Exact point-in-polygon, with the outline itself hit within `tolerance`.
     *
     * The outline test is not redundant: a location drawn as a thin sliver, or one the author is
     * trying to select by its edge rather than its middle, is unclickable on the fill test alone.
     */
    hitTest(world: TPoint, tolerance = 0): boolean {
        if (!this.visible) return false;
        if (isPointInPolygon(world, this._points)) return true;
        if (tolerance <= 0 || this._points.length < 2) return false;
        return distanceToOutline(world, this._points).distance <= tolerance;
    }

    translate(delta: TPoint): void {
        this._points = translatePolygon(this._points, delta);
        this.notify('points');
    }

    toSpec(): TDrawSpec {
        const children: TDrawSpec[] = [
            {
                kind: 'polygon',
                points: toFlatPoints(this._points),
                fill: this._color,
                // Fill translucency lives here rather than on the group so the outline stays
                // opaque: a 0.35-alpha outline on a dark map is invisible.
                opacity: this._fillOpacity,
                listening: false,
            },
            {
                kind: 'line',
                points: toFlatPoints(this._points),
                closed: true,
                stroke: this._selected ? SELECTED_STROKE : (this._stroke ?? this._color),
                strokeWidth: this._selected ? this._strokeWidth + 1 : this._strokeWidth,
                // Screen-width: an outline that scales with zoom is a hairline when zoomed out
                // and a slab when zoomed in.
                strokeScaleEnabled: false,
                lineJoin: 'round',
                dash: this._selected ? [6, 4] : undefined,
            },
        ];

        if (this._label) {
            children.push({
                kind: 'text',
                position: this.center,
                text: this._label,
                fontSize: 13,
                fill: this._labelColor,
                centered: true,
            });
        }

        return { kind: 'group', children };
    }

    toJSON(): TPolygonObjectJSON {
        return {
            ...super.toJSON(),
            points: this._points.map((point) => ({ ...point })),
            color: this._color,
            stroke: this._stroke,
            strokeWidth: this._strokeWidth,
            fillOpacity: this._fillOpacity,
            label: this._label,
        };
    }

    static fromJSON(json: TPolygonObjectJSON): PolygonObject {
        const polygon = new PolygonObject({
            id: json.id,
            points: json.points,
            color: json.color,
            stroke: json.stroke,
            strokeWidth: json.strokeWidth,
            fillOpacity: json.fillOpacity,
            label: json.label,
        });
        polygon.applyBaseJSON(json);
        return polygon;
    }
}
