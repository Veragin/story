import { boundsOf, distanceToSegment, sub } from '../geometry';
import { drawTextBlock } from '../text';
import type { TPoint, TRect } from '../types';
import { applyStroke, halfStrokeWidth, Shape, type TRenderContext, type TShapeProps } from './Shape';

/** A line end anchored to another shape. `border` (default) stops at the shape's outline. */
export type TShapeAnchor = { shape: Shape; anchor?: 'center' | 'border'; offset?: TPoint };

/** A free world point, or an anchor that follows a shape as it moves. */
export type TLineEnd = TPoint | TShapeAnchor;

export type TArrow = 'none' | 'start' | 'end' | 'both';

export type TLineProps<TData = unknown> = TShapeProps<TData> & {
    from: TLineEnd;
    to: TLineEnd;
    arrow?: TArrow;
    /** Arrowhead length in world units. Default `max(10, 4 × stroke width)`. */
    arrowSize?: number;
};

export const isAnchor = (end: TLineEnd): end is TShapeAnchor => 'shape' in end;

const DEFAULT_STROKE = { color: '#ccc', width: 2 };

export class LineShape<TData = unknown> extends Shape<TData> {
    readonly kind = 'line';
    from: TLineEnd;
    to: TLineEnd;
    arrow: TArrow;
    arrowSize?: number;

    constructor(props: TLineProps<TData>) {
        super({ ...props, stroke: props.stroke ?? DEFAULT_STROKE });
        this.from = props.from;
        this.to = props.to;
        this.arrow = props.arrow ?? 'none';
        this.arrowSize = props.arrowSize;
    }

    update(patch: Partial<TLineProps<TData>>): this {
        return super.update(patch);
    }

    /** The two resolved world end points (anchors resolved against the other end). */
    getEndpoints(): [TPoint, TPoint] {
        const ref = (end: TLineEnd): TPoint => (isAnchor(end) ? end.shape.getCenter() : end);
        const resolve = (end: TLineEnd, other: TLineEnd): TPoint => {
            if (!isAnchor(end)) return end;
            const base = end.anchor === 'center' ? end.shape.getCenter() : end.shape.borderPoint(ref(other));
            return end.offset ? { x: base.x + end.offset.x, y: base.y + end.offset.y } : base;
        };
        return [resolve(this.from, this.to), resolve(this.to, this.from)];
    }

    getBounds(): TRect {
        return boundsOf(this.getEndpoints());
    }

    hitTest(p: TPoint, tolerance: number): boolean {
        const [a, b] = this.getEndpoints();
        return distanceToSegment(p, a, b) <= tolerance + halfStrokeWidth(this.stroke, this.zoom);
    }

    tracePath(ctx: CanvasRenderingContext2D): void {
        const [a, b] = this.getEndpoints();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
    }

    canTranslate(): boolean {
        return !isAnchor(this.from) && !isAnchor(this.to);
    }

    translate(dx: number, dy: number): void {
        if (!isAnchor(this.from)) this.from = { x: this.from.x + dx, y: this.from.y + dy };
        if (!isAnchor(this.to)) this.to = { x: this.to.x + dx, y: this.to.y + dy };
        this.invalidate();
    }

    getOrigin(): TPoint {
        return this.getEndpoints()[0];
    }

    private arrowLength(zoom: number): number {
        if (this.arrowSize) return this.arrowSize;
        return Math.max(10, halfStrokeWidth(this.stroke, zoom) * 8);
    }

    draw(ctx: CanvasRenderingContext2D, rc: TRenderContext): void {
        const stroke = (rc.hovered && this.hoverStyle?.stroke) || this.stroke || DEFAULT_STROKE;
        const [a, b] = this.getEndpoints();
        const len = this.arrowLength(rc.zoom);
        ctx.save();
        ctx.globalAlpha *= this.opacity;
        applyStroke(ctx, stroke, rc.zoom);
        // Stop the shaft at the arrowhead base so a thick line does not poke through the tip.
        const shorten = (from: TPoint, to: TPoint, has: boolean): TPoint => {
            if (!has) return from;
            const d = sub(to, from);
            const l = Math.hypot(d.x, d.y);
            if (l <= len) return from;
            return { x: from.x + (d.x / l) * len * 0.8, y: from.y + (d.y / l) * len * 0.8 };
        };
        const start = shorten(a, b, this.arrow === 'start' || this.arrow === 'both');
        const end = shorten(b, a, this.arrow === 'end' || this.arrow === 'both');
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = stroke.color;
        if (this.arrow === 'end' || this.arrow === 'both') drawArrowHead(ctx, a, b, len);
        if (this.arrow === 'start' || this.arrow === 'both') drawArrowHead(ctx, b, a, len);
        if (this.label) {
            const s = this.labelStyle ?? {};
            drawTextBlock(ctx, this.label, {
                x: (a.x + b.x) / 2,
                y: (a.y + b.y) / 2,
                align: 'center',
                verticalAlign: 'bottom',
                color: s.color ?? stroke.color,
                fontSize: s.fontSize ?? 12,
                fontFamily: s.fontFamily,
                fontWeight: s.fontWeight,
            });
        }
        ctx.restore();
    }
}

/** Filled triangular head at `tip`, pointing away from `from`. */
export function drawArrowHead(ctx: CanvasRenderingContext2D, from: TPoint, tip: TPoint, length: number): void {
    const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
    const spread = Math.PI / 7;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - length * Math.cos(angle - spread), tip.y - length * Math.sin(angle - spread));
    ctx.lineTo(tip.x - length * Math.cos(angle + spread), tip.y - length * Math.sin(angle + spread));
    ctx.closePath();
    ctx.fill();
}
