import { pointInRect } from '../geometry';
import { drawTextBlock } from '../text';
import type { TPoint, TRect } from '../types';
import { halfStrokeWidth, Shape, type TShapeProps } from './Shape';

export type TRectEdge = 'left' | 'right' | 'top' | 'bottom';

export type TRectProps<TData = unknown> = TShapeProps<TData> & {
    x: number;
    y: number;
    width: number;
    height: number;
    cornerRadius?: number;
    /** Edges the selection controller offers as resize handles (while selected + editable). */
    resizeEdges?: TRectEdge[];
    minWidth?: number;
    minHeight?: number;
    /** Last word on a resize: receives the proposed rect and returns the one to use. */
    constrainResize?: (rect: TRect, edge: TRectEdge, shape: RectShape<TData>) => TRect;
};

export class RectShape<TData = unknown> extends Shape<TData> {
    readonly kind = 'rect';
    x: number;
    y: number;
    width: number;
    height: number;
    cornerRadius: number;
    resizeEdges: TRectEdge[];
    minWidth: number;
    minHeight: number;
    constrainResize?: TRectProps<TData>['constrainResize'];

    constructor(props: TRectProps<TData>) {
        super(props);
        this.x = props.x;
        this.y = props.y;
        this.width = props.width;
        this.height = props.height;
        this.cornerRadius = props.cornerRadius ?? 0;
        this.resizeEdges = props.resizeEdges ?? [];
        this.minWidth = props.minWidth ?? 1;
        this.minHeight = props.minHeight ?? 1;
        this.constrainResize = props.constrainResize;
    }

    update(patch: Partial<TRectProps<TData>>): this {
        return super.update(patch);
    }

    get rect(): TRect {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    setRect(r: Partial<TRect>): void {
        Object.assign(this, r);
        this.invalidate();
    }

    getBounds(): TRect {
        return this.rect;
    }

    hitTest(p: TPoint, tolerance: number): boolean {
        return pointInRect(p, this.rect, tolerance + halfStrokeWidth(this.stroke, this.zoom));
    }

    tracePath(ctx: CanvasRenderingContext2D): void {
        const r = Math.min(this.cornerRadius, this.width / 2, this.height / 2);
        if (r > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(this.x, this.y, this.width, this.height, r);
        else ctx.rect(this.x, this.y, this.width, this.height);
    }

    translate(dx: number, dy: number): void {
        this.x += dx;
        this.y += dy;
        this.invalidate();
    }

    getOrigin(): TPoint {
        return { x: this.x, y: this.y };
    }

    protected drawLabel(ctx: CanvasRenderingContext2D): void {
        if (!this.label) return;
        const s = this.labelStyle ?? {};
        const padding = s.padding ?? 6;
        const fontSize = s.fontSize ?? 14;
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.clip();
        const topLeft = s.placement === 'top-left';
        drawTextBlock(ctx, this.label, {
            x: topLeft ? this.x + padding : this.x + this.width / 2,
            y: topLeft ? this.y + padding : this.y + this.height / 2,
            align: topLeft ? 'left' : 'center',
            verticalAlign: topLeft ? 'top' : 'middle',
            maxWidth: Math.max(0, this.width - padding * 2),
            color: s.color ?? '#fff',
            fontSize,
            fontFamily: s.fontFamily,
            fontWeight: s.fontWeight,
        });
        ctx.restore();
    }
}
