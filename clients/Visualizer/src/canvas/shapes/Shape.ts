import type { Camera } from '../Camera';
import { rectBorderPoint, rectCenter } from '../geometry';
import type { TPoint, TRect, TStroke } from '../types';

export interface IShapeHost {
    readonly camera: Camera;
    invalidate(): void;
    markOrderDirty(): void;
}

export type TDragOptions = {
    axis?: 'x' | 'y';
    constrain?: (origin: TPoint, shape: Shape) => TPoint;
};

export type TLabelStyle = {
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    padding?: number;
    placement?: 'center' | 'top-left';
};

export type TShapeProps<TData = unknown> = {
    id?: string;
    fill?: string;
    stroke?: TStroke;
    zIndex?: number;
    visible?: boolean;
    draggable?: boolean;
    selectable?: boolean;
    interactive?: boolean;
    cursor?: string;
    hoverStyle?: { fill?: string; stroke?: TStroke };
    opacity?: number;
    drag?: TDragOptions;
    label?: string;
    labelStyle?: TLabelStyle;
    data?: TData;
    // method syntax keeps `Shape<T>` assignable to `Shape`
    onAction?(shape: Shape<TData>): void;
};

export type TRenderContext = {
    camera: Camera;
    zoom: number;
    hovered: boolean;
};

let nextId = 1;

export abstract class Shape<TData = unknown> {
    abstract readonly kind: string;

    id: string;
    fill?: string;
    stroke?: TStroke;
    private _zIndex: number;
    visible: boolean;
    draggable: boolean;
    selectable: boolean;
    interactive: boolean;
    cursor?: string;
    hoverStyle?: { fill?: string; stroke?: TStroke };
    opacity: number;
    drag?: TDragOptions;
    label?: string;
    labelStyle?: TLabelStyle;
    data: TData;
    onAction?(shape: Shape<TData>): void;

    hovered = false;
    host: IShapeHost | null = null;
    layerName: string | null = null;

    constructor(props: TShapeProps<TData>) {
        this.id = props.id ?? `shape-${nextId++}`;
        this.fill = props.fill;
        this.stroke = props.stroke;
        this._zIndex = props.zIndex ?? 0;
        this.visible = props.visible ?? true;
        this.draggable = props.draggable ?? false;
        this.selectable = props.selectable ?? true;
        this.interactive = props.interactive ?? true;
        this.cursor = props.cursor;
        this.hoverStyle = props.hoverStyle;
        this.opacity = props.opacity ?? 1;
        this.drag = props.drag;
        this.label = props.label;
        this.labelStyle = props.labelStyle;
        this.data = props.data as TData;
        this.onAction = props.onAction;
    }

    get zIndex(): number {
        return this._zIndex;
    }
    set zIndex(z: number) {
        if (z === this._zIndex) return;
        this._zIndex = z;
        this.host?.markOrderDirty();
        this.invalidate();
    }

    update(patch: Partial<TShapeProps<TData>>): this {
        Object.assign(this, patch);
        this.invalidate();
        return this;
    }

    invalidate(): void {
        this.host?.invalidate();
    }

    protected get zoom(): number {
        return this.host?.camera.zoom ?? 1;
    }

    abstract getBounds(): TRect;

    // `tolerance` is in world units
    abstract hitTest(p: TPoint, tolerance: number): boolean;

    abstract tracePath(ctx: CanvasRenderingContext2D): void;

    abstract translate(dx: number, dy: number): void;

    getOrigin(): TPoint {
        const b = this.getBounds();
        return { x: b.x, y: b.y };
    }

    setOrigin(p: TPoint): void {
        const o = this.getOrigin();
        if (o.x === p.x && o.y === p.y) return;
        this.translate(p.x - o.x, p.y - o.y);
    }

    getCenter(): TPoint {
        return rectCenter(this.getBounds());
    }

    borderPoint(toward: TPoint): TPoint {
        return rectBorderPoint(this.getBounds(), toward);
    }

    canTranslate(): boolean {
        return true;
    }

    draw(ctx: CanvasRenderingContext2D, rc: TRenderContext): void {
        const fill = (rc.hovered && this.hoverStyle?.fill) || this.fill;
        const stroke = (rc.hovered && this.hoverStyle?.stroke) || this.stroke;
        ctx.save();
        ctx.globalAlpha *= this.opacity;
        ctx.beginPath();
        this.tracePath(ctx);
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke) {
            applyStroke(ctx, stroke, rc.zoom);
            ctx.stroke();
        }
        this.drawLabel(ctx, rc);
        ctx.restore();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected drawLabel(ctx: CanvasRenderingContext2D, rc: TRenderContext): void {}

    protected labelFont(defaultColor: string, defaultFontSize: number) {
        const s = this.labelStyle ?? {};
        return {
            color: s.color ?? defaultColor,
            fontSize: s.fontSize ?? defaultFontSize,
            fontFamily: s.fontFamily,
            fontWeight: s.fontWeight,
        };
    }
}

export const applyStroke = (ctx: CanvasRenderingContext2D, stroke: TStroke, zoom: number): void => {
    const k = stroke.screenWidth ? 1 / zoom : 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * k;
    ctx.setLineDash(stroke.dash ? stroke.dash.map((d) => d * k) : []);
};

export const halfStrokeWidth = (stroke: TStroke | undefined, zoom: number): number => {
    if (!stroke) return 0;
    return (stroke.screenWidth ? stroke.width / zoom : stroke.width) / 2;
};
