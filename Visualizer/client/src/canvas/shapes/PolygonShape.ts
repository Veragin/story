import { boundsOf, distanceToPolygonEdge, pointInPolygon, polygonBorderPoint, polygonCentroid } from '../geometry';
import { drawTextBlock } from '../text';
import type { TPoint, TRect } from '../types';
import { halfStrokeWidth, Shape, type TShapeProps } from './Shape';

export type TPolygonProps<TData = unknown> = TShapeProps<TData> & {
    points: TPoint[];
    /** Whether `VertexEditController` may edit it. Default true. */
    vertexEditable?: boolean;
};

export class PolygonShape<TData = unknown> extends Shape<TData> {
    readonly kind = 'polygon';
    points: TPoint[];
    vertexEditable: boolean;

    constructor(props: TPolygonProps<TData>) {
        super(props);
        this.points = props.points.map((p) => ({ ...p }));
        this.vertexEditable = props.vertexEditable ?? true;
    }

    update(patch: Partial<TPolygonProps<TData>>): this {
        return super.update(patch);
    }

    setPoints(points: TPoint[]): void {
        this.points = points.map((p) => ({ ...p }));
        this.invalidate();
    }

    moveVertex(index: number, p: TPoint): void {
        this.points[index] = { ...p };
        this.invalidate();
    }

    /** Inserts `p` so it becomes vertex `index`. */
    insertVertex(index: number, p: TPoint): void {
        this.points.splice(index, 0, { ...p });
        this.invalidate();
    }

    removeVertex(index: number): void {
        this.points.splice(index, 1);
        this.invalidate();
    }

    getBounds(): TRect {
        return boundsOf(this.points);
    }

    hitTest(p: TPoint, tolerance: number): boolean {
        if (this.points.length < 2) return false;
        if (this.points.length >= 3 && pointInPolygon(p, this.points)) return true;
        return distanceToPolygonEdge(p, this.points) <= tolerance + halfStrokeWidth(this.stroke, this.zoom);
    }

    tracePath(ctx: CanvasRenderingContext2D): void {
        this.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
    }

    translate(dx: number, dy: number): void {
        this.points = this.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        this.invalidate();
    }

    getCenter(): TPoint {
        return polygonCentroid(this.points);
    }

    borderPoint(toward: TPoint): TPoint {
        const c = this.getCenter();
        return polygonBorderPoint(this.points, c, toward) ?? c;
    }

    protected drawLabel(ctx: CanvasRenderingContext2D): void {
        if (!this.label) return;
        const s = this.labelStyle ?? {};
        const c = this.getCenter();
        drawTextBlock(ctx, this.label, {
            x: c.x,
            y: c.y,
            align: 'center',
            verticalAlign: 'middle',
            color: s.color ?? '#fff',
            fontSize: s.fontSize ?? 14,
            fontFamily: s.fontFamily,
            fontWeight: s.fontWeight,
        });
    }
}
