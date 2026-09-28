import type { Camera } from '../Camera';
import { rectBorderPoint, rectCenter } from '../geometry';
import type { TPoint, TRect, TStroke } from '../types';

/** What a shape needs from the scene it lives in. Implemented by `Scene`. */
export interface IShapeHost {
    readonly camera: Camera;
    invalidate(): void;
    /** Called when a shape's `zIndex` changed, so the draw order gets re-sorted. */
    markOrderDirty(): void;
}

export type TDragOptions = {
    /** Restricts dragging to one axis. */
    axis?: 'x' | 'y';
    /**
     * Last word on where a drag may put the shape. Receives the proposed origin (see
     * `Shape.getOrigin`) after `axis` was applied and returns the one to use.
     */
    constrain?: (origin: TPoint, shape: Shape) => TPoint;
};

export type TLabelStyle = {
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string | number;
    /** Inner padding in world units (rects only). */
    padding?: number;
    /** Rects only: `center` (default) or `top-left`. */
    placement?: 'center' | 'top-left';
};

export type TShapeProps<TData = unknown> = {
    id?: string;
    fill?: string;
    stroke?: TStroke;
    zIndex?: number;
    visible?: boolean;
    /** Whether the selection controller may drag it once selected. Default false. */
    draggable?: boolean;
    /** Whether a click selects it. Default true. */
    selectable?: boolean;
    /** Whether it takes part in hit-testing at all (hover, click, double-click). Default true. */
    interactive?: boolean;
    /** CSS cursor while hovering it. */
    cursor?: string;
    /** Overrides applied while the pointer is over the shape. */
    hoverStyle?: { fill?: string; stroke?: TStroke };
    opacity?: number;
    drag?: TDragOptions;
    label?: string;
    labelStyle?: TLabelStyle;
    /** Free payload for the page (entity id, DTO, ...). */
    data?: TData;
    /** Called on double-click (the scene also emits `action`). Method syntax keeps `Shape<T>` assignable to `Shape`. */
    onAction?(shape: Shape<TData>): void;
};

export type TRenderContext = {
    camera: Camera;
    zoom: number;
    hovered: boolean;
};

let nextId = 1;

/**
 * Base class of every scene object. Subclasses implement geometry (`getBounds`, `hitTest`,
 * `tracePath`, `translate`); the base handles style, labels and change notification.
 *
 * Mutate through `update(patch)` or the subclass setters so the scene redraws. If you assign a
 * field directly, call `invalidate()` afterwards.
 */
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

    /** Set by the scene while the pointer is over this shape. */
    hovered = false;
    /** The scene (or null while detached). Managed by `Scene.add`/`Scene.remove`. */
    host: IShapeHost | null = null;
    /** Name of the layer it was added to. Managed by the scene. */
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

    /** Assigns any props and redraws. */
    update(patch: Partial<TShapeProps<TData>>): this {
        Object.assign(this, patch);
        this.invalidate();
        return this;
    }

    invalidate(): void {
        this.host?.invalidate();
    }

    /** Current zoom of the owning scene (1 while detached). */
    protected get zoom(): number {
        return this.host?.camera.zoom ?? 1;
    }

    abstract getBounds(): TRect;

    /** `tolerance` is in world units (the scene converts its pixel tolerance with the zoom). */
    abstract hitTest(p: TPoint, tolerance: number): boolean;

    /** Builds the outline path (used for fill, stroke and the selection highlight). */
    abstract tracePath(ctx: CanvasRenderingContext2D): void;

    /** Moves the shape by a world delta. Must call `invalidate()`. */
    abstract translate(dx: number, dy: number): void;

    /** The point dragging moves around; `drag.constrain` receives and returns it. Default: bounds top-left. */
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

    /** Where a line coming from `toward` meets this shape's border. */
    borderPoint(toward: TPoint): TPoint {
        return rectBorderPoint(this.getBounds(), toward);
    }

    /** Whether the shape can be moved as a whole (lines anchored to shapes cannot). */
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

    /** Draws `label`. Subclasses place it; the default does nothing. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected drawLabel(ctx: CanvasRenderingContext2D, rc: TRenderContext): void {}
}

/** Sets stroke style, width and dash, converting screen-pixel widths with the zoom. */
export function applyStroke(ctx: CanvasRenderingContext2D, stroke: TStroke, zoom: number): void {
    const k = stroke.screenWidth ? 1 / zoom : 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * k;
    ctx.setLineDash(stroke.dash ? stroke.dash.map((d) => d * k) : []);
}

/** Half the stroke width in world units, used to widen hit areas. */
export function halfStrokeWidth(stroke: TStroke | undefined, zoom: number): number {
    if (!stroke) return 0;
    return (stroke.screenWidth ? stroke.width / zoom : stroke.width) / 2;
}
