import { ConditionalObserver, type TBBox, type TPoint, type TSize } from '@story/shared';
import { isEmptyBBox } from '../geometry/polygon';
import type { TViewportTransform } from '../renderer/types';

/**
 * The world↔screen transform, and the only place in `@story/canvas` where a screen pixel is a
 * legal unit (VISUALIZER_PLAN §3.2 design rule 1).
 *
 * The model is carried over from the engine this package replaces (`CanvasWorld`): zoom is
 * stored as **`pixelSize` — the world-unit extent of one screen pixel** — rather than as a
 * scale factor, and it is a `TSize` rather than a scalar so the two axes can zoom
 * independently. That is not generality for its own sake: the timeline zooms time and rows at
 * different rates, and it is the reason the old engine had `anisotropicZoomAtPoint`. Storing
 * pixel size rather than scale also keeps the number the code reasons about ("how much world
 * fits in a pixel") the one that clamps meaningfully.
 *
 * Nothing here touches the DOM, so it is unit-tested in Vitest's `node` environment.
 */

/** Smallest legal pixel size; guards the divisions below against a zoom that reaches zero. */
const MIN_PIXEL_SIZE = 1e-5;

export type TViewportOptions = {
    /** World units per pixel at the most zoomed-*in* end. Larger = less zoom-in allowed. */
    minPixelSize?: number;
    /** World units per pixel at the most zoomed-*out* end. */
    maxPixelSize?: number;
    /** Starting world coordinate of the top-left corner. */
    position?: TPoint;
    /** Starting world-units-per-pixel. */
    pixelSize?: TSize;
};

export class Viewport {
    private _position: TPoint;
    private _pixelSize: TSize;
    private _size: TSize = { width: 0, height: 0 };

    private readonly minPixelSize: number;
    private readonly maxPixelSize: number;

    /**
     * Fires when the transform changes in a way that matters to a pixel. Conditional rather
     * than a plain `Observer` because pan is driven by pointer-move: a drag that does not
     * actually move the view (the same integer pixel twice) must not schedule a redraw.
     */
    readonly onChange = new ConditionalObserver<TViewportTransform>((next, last) => {
        if (!last) return true;
        return (
            next.position.x !== last.position.x ||
            next.position.y !== last.position.y ||
            Math.abs(next.scale.width - last.scale.width) > 1e-9 ||
            Math.abs(next.scale.height - last.scale.height) > 1e-9
        );
    });

    /** Fires when the canvas element itself is resized. */
    readonly onResize = new ConditionalObserver<TSize>((next, last) => {
        if (!last) return true;
        return next.width !== last.width || next.height !== last.height;
    });

    constructor(options: TViewportOptions = {}) {
        this.minPixelSize = Math.max(MIN_PIXEL_SIZE, options.minPixelSize ?? 0.01);
        this.maxPixelSize = options.maxPixelSize ?? 1000;
        this._position = options.position ? { ...options.position } : { x: 0, y: 0 };
        this._pixelSize = this.clampPixelSize(options.pixelSize ?? { width: 1, height: 1 });
    }

    /* ---------------------------------------------------------------- state */

    /** World coordinate rendered at screen `(0, 0)`. */
    get position(): TPoint {
        return this._position;
    }

    /** World units covered by one screen pixel, per axis. Smaller = more zoomed in. */
    get pixelSize(): TSize {
        return this._pixelSize;
    }

    /** Screen pixels per world unit, per axis — what the renderer wants. */
    get scale(): TSize {
        return { width: 1 / this._pixelSize.width, height: 1 / this._pixelSize.height };
    }

    /** Canvas size in CSS pixels. */
    get size(): TSize {
        return this._size;
    }

    get transform(): TViewportTransform {
        return { position: this._position, scale: this.scale };
    }

    setSize(size: TSize): void {
        if (size.width === this._size.width && size.height === this._size.height) return;
        this._size = { width: size.width, height: size.height };
        this.onResize.notify(this._size);
        this.onChange.forceNotify(this.transform);
    }

    /**
     * Sets position and zoom together. Every mutator below funnels through this one, so there
     * is exactly one notification per logical change — the old engine needed a dedicated
     * `atomicZoomAndPositionUpdate` precisely because it had two setters that each notified,
     * and a zoom-at-point through them flickered.
     */
    set(next: { position?: TPoint; pixelSize?: TSize }): void {
        if (next.pixelSize) this._pixelSize = this.clampPixelSize(next.pixelSize);
        if (next.position) this._position = { x: next.position.x, y: next.position.y };
        this.onChange.notify(this.transform);
    }

    private clampPixelSize(size: TSize): TSize {
        return {
            width: Math.min(this.maxPixelSize, Math.max(this.minPixelSize, size.width)),
            height: Math.min(this.maxPixelSize, Math.max(this.minPixelSize, size.height)),
        };
    }

    /* ------------------------------------------------------------ transform */

    screenToWorld(screen: TPoint): TPoint {
        return {
            x: this._position.x + screen.x * this._pixelSize.width,
            y: this._position.y + screen.y * this._pixelSize.height,
        };
    }

    worldToScreen(world: TPoint): TPoint {
        return {
            x: (world.x - this._position.x) / this._pixelSize.width,
            y: (world.y - this._position.y) / this._pixelSize.height,
        };
    }

    /** A *delta* has no origin, so it scales without translating. */
    screenDeltaToWorld(delta: TPoint): TPoint {
        return { x: delta.x * this._pixelSize.width, y: delta.y * this._pixelSize.height };
    }

    worldDeltaToScreen(delta: TPoint): TPoint {
        return { x: delta.x / this._pixelSize.width, y: delta.y / this._pixelSize.height };
    }

    /** Converts a screen-pixel length to world units on the x axis — handle radii, tolerances. */
    screenLengthToWorld(length: number): number {
        return length * this._pixelSize.width;
    }

    /* ----------------------------------------------------------- navigation */

    /**
     * Moves the view by a screen-pixel delta. The sign is "content follows the pointer": a
     * drag to the right moves the world right, which means the *view* moves left.
     */
    pan(screenDelta: TPoint): void {
        const worldDelta = this.screenDeltaToWorld(screenDelta);
        this.set({ position: { x: this._position.x - worldDelta.x, y: this._position.y - worldDelta.y } });
    }

    /** Moves the view by a world-unit delta — what the WSAD/arrow keys use. */
    panWorld(worldDelta: TPoint): void {
        this.set({ position: { x: this._position.x + worldDelta.x, y: this._position.y + worldDelta.y } });
    }

    /**
     * Zooms by `factor` about a screen point, keeping the world point under that pixel pinned.
     * `factor > 1` zooms in. Scalar or per-axis; the per-axis form is the timeline's.
     */
    zoomAt(screen: TPoint, factor: number | TSize): void {
        const factors = typeof factor === 'number' ? { width: factor, height: factor } : factor;
        const before = this.screenToWorld(screen);

        const nextPixelSize = this.clampPixelSize({
            width: this._pixelSize.width / factors.width,
            height: this._pixelSize.height / factors.height,
        });

        // Where that same pixel *would* land after the zoom, computed without notifying.
        const after = {
            x: this._position.x + screen.x * nextPixelSize.width,
            y: this._position.y + screen.y * nextPixelSize.height,
        };

        this.set({
            pixelSize: nextPixelSize,
            position: { x: this._position.x + before.x - after.x, y: this._position.y + before.y - after.y },
        });
    }

    /** Zooms about the centre of the canvas — the zoom slider and the `+`/`-` keys. */
    zoomAtCenter(factor: number | TSize): void {
        this.zoomAt({ x: this._size.width / 2, y: this._size.height / 2 }, factor);
    }

    /** The world rectangle currently on screen. */
    get visibleBounds(): TBBox {
        return {
            min: this.screenToWorld({ x: 0, y: 0 }),
            max: this.screenToWorld({ x: this._size.width, y: this._size.height }),
        };
    }

    /** World coordinate at the centre of the canvas. */
    get center(): TPoint {
        return this.screenToWorld({ x: this._size.width / 2, y: this._size.height / 2 });
    }

    /** Moves the view so `world` sits at the centre of the canvas, without changing zoom. */
    centerOn(world: TPoint): void {
        this.set({
            position: {
                x: world.x - (this._size.width / 2) * this._pixelSize.width,
                y: world.y - (this._size.height / 2) * this._pixelSize.height,
            },
        });
    }

    /**
     * Zooms and pans so `box` fills the canvas with `padding` screen pixels to spare.
     *
     * Deliberately *isotropic* — it picks the single pixel size that fits both axes — because
     * an anisotropic fit would silently stretch a map's shapes to the window's aspect ratio.
     * A caller that wants the stretch (the timeline, fitting a time range to a row height) sets
     * `pixelSize` directly.
     *
     * A degenerate box (one point, or empty) only centres: there is no meaningful zoom for a
     * zero-extent target, and picking one would send the view to the clamp.
     */
    fit(box: TBBox, padding = 24): void {
        if (isEmptyBBox(box) || this._size.width <= 0 || this._size.height <= 0) return;

        const width = box.max.x - box.min.x;
        const height = box.max.y - box.min.y;
        const center = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 };

        if (width <= 0 && height <= 0) {
            this.centerOn(center);
            return;
        }

        const usableWidth = Math.max(1, this._size.width - padding * 2);
        const usableHeight = Math.max(1, this._size.height - padding * 2);
        const pixel = Math.max(width / usableWidth, height / usableHeight);
        const pixelSize = this.clampPixelSize({ width: pixel, height: pixel });

        this.set({
            pixelSize,
            position: {
                x: center.x - (this._size.width / 2) * pixelSize.width,
                y: center.y - (this._size.height / 2) * pixelSize.height,
            },
        });
    }

    reset(): void {
        this.set({ position: { x: 0, y: 0 }, pixelSize: { width: 1, height: 1 } });
    }
}
