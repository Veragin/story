import { Observer, type TColor } from '@story/shared';
import { BrushStroke, DEFAULT_SIMPLIFY_EPSILON } from '../objects/BrushStroke';
import type { TPointerEvent } from '../renderer/types';
import { BaseTool } from './Tool';

/**
 * Hold to draw, with a colour and a size (VISUALIZER_PLAN §3.2 `tools/BrushTool.ts`; README
 * § Visualizer, "brush tool — colour, size, hold to draw").
 *
 * The stroke is built directly into a live `BrushStroke` on the `content` layer — no preview
 * object and no copy at the end. What the author sees during the stroke is the object that
 * will be kept.
 *
 * ## Where §4.3's mitigations happen
 *
 * `finish()` on pointer-up rounds coordinates to integers and runs Ramer–Douglas–Peucker, so
 * what reaches `data/` is already the simplified run — not the raw one-point-per-pointer-move
 * trace. The tool also enforces a minimum world distance between samples, which throws away the
 * bulk of the input before RDP ever sees it: at high zoom a slow hand generates dozens of
 * samples per world unit, and none of them carry shape.
 *
 * A stroke that ends up as a single point is discarded rather than persisted — that gesture was
 * a click, not a stroke, and a one-point "stroke" in `data/` is invisible and un-deletable.
 */

export type TBrushToolOptions = {
    color?: TColor;
    /** World units. */
    width?: number;
    /** Minimum world distance between recorded samples. */
    minimumSampleDistance?: number;
    /** RDP epsilon applied on pointer-up. */
    simplifyEpsilon?: number;
    generateId?: () => string;
    /** Layer to draw on. The map puts strokes below its locations. */
    layer?: 'background' | 'content';
};

let sequence = 0;

export class BrushTool extends BaseTool {
    readonly name = 'brush';
    readonly cursor = 'crosshair';

    /** Fires once a finished stroke has been added. */
    readonly onCreated = new Observer<BrushStroke>();

    color: TColor;
    width: number;

    private readonly minimumSampleDistance: number;
    private readonly simplifyEpsilon: number;
    private readonly generateId: () => string;
    private readonly layer: 'background' | 'content';

    private stroke: BrushStroke | null = null;
    private lastSample: { x: number; y: number } | null = null;

    constructor(options: TBrushToolOptions = {}) {
        super();
        this.color = options.color ?? '#5b8dd6';
        this.width = options.width ?? 6;
        this.minimumSampleDistance = options.minimumSampleDistance ?? 2;
        this.simplifyEpsilon = options.simplifyEpsilon ?? DEFAULT_SIMPLIFY_EPSILON;
        this.generateId = options.generateId ?? (() => `stroke-${++sequence}`);
        this.layer = options.layer ?? 'content';
    }

    /** True while the button is held and a stroke is being drawn. */
    get isDrawing(): boolean {
        return this.stroke !== null;
    }

    protected onCancel(): void {
        // An abandoned stroke is removed outright; it never reached the undo stack.
        if (this.stroke) this.scene.remove(this.stroke);
        this.stroke = null;
        this.lastSample = null;
    }

    onPointerDown(event: TPointerEvent): boolean | void {
        this.stroke = new BrushStroke({
            id: this.generateId(),
            layer: this.layer,
            points: [event.world.x, event.world.y],
            color: this.color,
            width: this.width,
        });
        this.stroke.transient = true;
        this.scene.add(this.stroke);
        this.lastSample = { ...event.world };
        return true;
    }

    onPointerMove(event: TPointerEvent): boolean | void {
        if (!this.stroke || !this.lastSample) return;

        const travelled = Math.hypot(event.world.x - this.lastSample.x, event.world.y - this.lastSample.y);
        if (travelled < this.minimumSampleDistance) return true;

        this.stroke.addPoint(event.world);
        this.lastSample = { ...event.world };
        return true;
    }

    onPointerUp(event: TPointerEvent): boolean | void {
        if (!this.stroke) return;

        const stroke = this.stroke;
        this.stroke = null;
        this.lastSample = null;

        // The final sample is always taken, however short the last move was: without it the
        // stroke stops up to `minimumSampleDistance` short of where the author released.
        stroke.addPoint(event.world);
        stroke.transient = false;

        const remaining = stroke.finish(this.simplifyEpsilon);
        if (remaining < 2) {
            // A click, not a stroke.
            this.scene.remove(stroke);
            return true;
        }

        this.history.record({
            label: 'Draw stroke',
            execute: () => this.scene.add(stroke),
            undo: () => this.scene.remove(stroke),
        });
        this.onCreated.notify(stroke);
        return true;
    }
}
