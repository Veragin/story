import { Observer, type TColor, type TPoint } from '@story/shared';
import { PolygonObject } from '../objects/PolygonObject';
import type { TKeyEvent, TPointerEvent } from '../renderer/types';
import { BaseTool } from './Tool';
import { VertexHandlesObject } from './VertexHandlesObject';

/**
 * Draws a polygon: click to add a vertex, close on a click near the first vertex or on Enter,
 * `Esc` cancels (VISUALIZER_PLAN §3.2 `tools/PolygonDrawTool.ts`).
 *
 * ## Why the preview is a live `PolygonObject`
 *
 * The shape under construction is a real `PolygonObject` on the `overlay` layer, not a special
 * preview primitive. That means what the author sees while drawing is drawn by exactly the code
 * that will draw it afterwards — there is no second renderer to keep in sync, and "it looked
 * different once I finished" cannot happen. On completion it moves to `content`; on cancel it
 * is removed.
 *
 * ## Click, not drag
 *
 * A vertex is committed on pointer-*up* within the click threshold, so that a drag over the
 * canvas pans (if navigation is bound to it) rather than scattering vertices. The rubber-band
 * segment to the cursor is redrawn on move.
 */

export type TPolygonDrawToolOptions = {
    color?: TColor;
    fillOpacity?: number;
    /** Minimum vertices before the ring can be closed. Three is the smallest real polygon. */
    minVertices?: number;
    /** Id for the finished object. Defaults to a counter-based one. */
    generateId?: () => string;
    /** Return to the select tool after each polygon. Default true. */
    oneShot?: boolean;
};

export type TPolygonCreated = {
    polygon: PolygonObject;
    /** True when the finished ring crosses itself — the caller decides whether to warn. */
    selfIntersecting: boolean;
};

let sequence = 0;

export class PolygonDrawTool extends BaseTool {
    readonly name = 'polygon-draw';
    readonly cursor = 'crosshair';

    /** Fires once a ring is closed. The map tab turns this into a new location. */
    readonly onCreated = new Observer<TPolygonCreated>();

    private readonly color: TColor;
    private readonly fillOpacity: number;
    private readonly minVertices: number;
    private readonly generateId: () => string;
    private readonly oneShot: boolean;

    private draft: PolygonObject | null = null;
    private handles: VertexHandlesObject | null = null;
    /** Committed vertices. The preview also carries the cursor as a provisional last point. */
    private vertices: TPoint[] = [];

    constructor(options: TPolygonDrawToolOptions = {}) {
        super();
        this.color = options.color ?? '#4f7fd4';
        this.fillOpacity = options.fillOpacity ?? 0.35;
        this.minVertices = options.minVertices ?? 3;
        this.generateId = options.generateId ?? (() => `polygon-${++sequence}`);
        this.oneShot = options.oneShot ?? true;
    }

    /** Vertices committed so far. For a toolbar that shows "3 points — Enter to close". */
    get vertexCount(): number {
        return this.vertices.length;
    }

    protected onCancel(): void {
        this.draft = null;
        this.handles = null;
        this.vertices = [];
    }

    onPointerDown(event: TPointerEvent): boolean | void {
        const point = this.snapPoint(event);

        // Closing click: near the first vertex, with enough vertices to make a polygon.
        if (this.snapping.shouldClose(point, this.vertices[0], this.vertices.length, this.minVertices)) {
            this.finish();
            return true;
        }

        this.vertices.push(point);
        this.ensureDraft();
        this.syncDraft(point);
        return true;
    }

    onPointerMove(event: TPointerEvent): boolean | void {
        if (this.vertices.length === 0) return;
        const point = this.snapPoint(event);

        // The cursor is shown as a provisional vertex, so the author sees the edge they are
        // about to commit rather than only the edges they already have.
        this.syncDraft(point);

        // Feedback that a click here would close the ring.
        const closing = this.snapping.shouldClose(point, this.vertices[0], this.vertices.length, this.minVertices);
        this.scene.setCursor(closing ? 'pointer' : this.cursor);
        return true;
    }

    /**
     * A double-click closes the ring, dropping the vertex the first click of the pair added —
     * otherwise every double-click-to-finish would leave a duplicate point at the end.
     */
    onDoubleClick(): boolean | void {
        if (this.vertices.length > this.minVertices) this.vertices.pop();
        if (this.vertices.length >= this.minVertices) {
            this.finish();
            return true;
        }
        return;
    }

    onKeyDown(event: TKeyEvent): boolean | void {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (this.vertices.length >= this.minVertices) this.finish();
            return true;
        }

        // Backspace undoes the last vertex rather than the last *command*: while drawing, that
        // is unambiguously what the author means, and the polygon is not on the undo stack yet.
        if (event.key === 'Backspace' && this.vertices.length > 0) {
            event.preventDefault();
            this.vertices.pop();
            if (this.vertices.length === 0) this.cancel();
            else this.syncDraft(this.vertices[this.vertices.length - 1]);
            return true;
        }

        if (event.key === 'Escape' && this.vertices.length > 0) {
            event.preventDefault();
            // Consume it: the first Escape abandons the drawing, a second returns to select.
            this.cancel();
            return true;
        }

        return;
    }

    private snapPoint(event: TPointerEvent): TPoint {
        // Alt suspends snapping, the convention in every vector editor.
        if (event.altKey) return event.world;

        // Candidates are every other polygon's vertices, so locations can be drawn flush
        // against their neighbours — the thing a map of adjacent regions needs most.
        const candidates: TPoint[] = [];
        for (const object of this.scene.all()) {
            if (object === this.draft) continue;
            if (object instanceof PolygonObject) candidates.push(...object.points);
        }
        return this.snapping.snap(event.world, candidates).point;
    }

    private ensureDraft(): void {
        if (this.draft) return;
        this.draft = this.addOverlay(
            new PolygonObject({
                id: `${this.generateId()}-draft`,
                layer: 'overlay',
                selectable: false,
                draggable: false,
                points: [],
                color: this.color,
                fillOpacity: this.fillOpacity,
            })
        );
        this.handles = this.addOverlay(new VertexHandlesObject({ id: 'polygon-draw-handles' }, []));
    }

    /** Redraws the preview as the committed vertices plus the cursor. */
    private syncDraft(cursor: TPoint): void {
        if (!this.draft) return;
        const preview = [...this.vertices];
        const last = preview[preview.length - 1];
        if (!last || last.x !== cursor.x || last.y !== cursor.y) preview.push(cursor);
        // Raw, not normalised: re-winding a half-drawn ring on every mouse move would make the
        // preview flip direction as the author crosses from clockwise to counter-clockwise.
        this.draft.setPointsRaw(preview);
        this.handles?.setPoints(this.vertices);
    }

    /** Closes the ring, publishes it, and clears the draft. */
    private finish(): void {
        if (this.vertices.length < this.minVertices) return;

        const polygon = new PolygonObject({
            id: this.generateId(),
            points: this.vertices,
            color: this.color,
            fillOpacity: this.fillOpacity,
        });

        this.vertices = [];
        this.draft = null;
        this.handles = null;
        this.clearOverlay();

        this.history.execute({
            label: 'Draw polygon',
            execute: () => this.scene.add(polygon),
            undo: () => this.scene.remove(polygon),
        });

        this.selection.set([polygon]);
        this.onCreated.notify({ polygon, selfIntersecting: polygon.selfIntersecting });

        if (this.oneShot) this.scene.setCursor('default');
    }

    /** True when `finish()` would leave the tool for the select tool. */
    get returnsToSelect(): boolean {
        return this.oneShot;
    }
}
