import { geometry, measureTextWidth, Shape, type TPoint, type TRect, type TShapeProps } from '../../../canvas';

export const TRIGGER_RADIUS = 7;
const NAME_FONT_SIZE = 12;
const NAME_GAP = 4;

export type TTriggerShapeProps<TData> = TShapeProps<TData> & {
    x: number;
    name: string;
    /** World y of the dot's center; read on every use, so the dot stays pinned above the strip. */
    getY: () => number;
};

/**
 * A time trigger: a green dot above the time strip with its name above it. Only `x` is state (the
 * trigger's time); `y` follows the strip, so moves are horizontal by construction.
 */
export class TriggerShape<TData = unknown> extends Shape<TData> {
    readonly kind = 'trigger';
    x: number;
    name: string;
    private readonly getY: () => number;

    constructor(props: TTriggerShapeProps<TData>) {
        super({ fill: '#43a047', stroke: { color: '#c8e6c9', width: 1.5, screenWidth: true }, ...props });
        this.x = props.x;
        this.name = props.name;
        this.getY = props.getY;
    }

    get y(): number {
        return this.getY();
    }

    update(patch: Partial<TTriggerShapeProps<TData>>): this {
        return super.update(patch);
    }

    private nameRect(): TRect {
        const width = measureTextWidth(this.name, { fontSize: NAME_FONT_SIZE });
        const height = NAME_FONT_SIZE * 1.25;
        return {
            x: this.x - width / 2,
            y: this.y - TRIGGER_RADIUS - NAME_GAP - height,
            width,
            height,
        };
    }

    getBounds(): TRect {
        const dot = {
            x: this.x - TRIGGER_RADIUS,
            y: this.y - TRIGGER_RADIUS,
            width: TRIGGER_RADIUS * 2,
            height: TRIGGER_RADIUS * 2,
        };
        if (!this.name) return dot;
        const n = this.nameRect();
        const x = Math.min(dot.x, n.x);
        const right = Math.max(dot.x + dot.width, n.x + n.width);
        return { x, y: n.y, width: right - x, height: dot.y + dot.height - n.y };
    }

    hitTest(p: TPoint, tolerance: number): boolean {
        if (Math.hypot(p.x - this.x, p.y - this.y) <= TRIGGER_RADIUS + tolerance) return true;
        return !!this.name && geometry.pointInRect(p, this.nameRect(), tolerance);
    }

    tracePath(ctx: CanvasRenderingContext2D): void {
        ctx.moveTo(this.x + TRIGGER_RADIUS, this.y);
        ctx.arc(this.x, this.y, TRIGGER_RADIUS, 0, Math.PI * 2);
    }

    translate(dx: number): void {
        this.x += dx;
        this.invalidate();
    }

    getOrigin(): TPoint {
        return { x: this.x, y: this.y };
    }

    protected drawLabel(ctx: CanvasRenderingContext2D): void {
        if (!this.name) return;
        const n = this.nameRect();
        ctx.font = `${NAME_FONT_SIZE}px Roboto, system-ui, sans-serif`;
        ctx.fillStyle = '#a5d6a7';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, this.x, n.y + n.height / 2);
    }
}
