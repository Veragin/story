import type { TPoint, TRect, TSize } from './types';

/**
 * View state. `x`/`y` is the **world** point shown at the screen's top-left corner, and `zoom`
 * is screen pixels per world unit. So `screen = (world - {x, y}) * zoom`.
 */
export type TCameraState = { x: number; y: number; zoom: number };

export type TCameraOptions = Partial<TCameraState> & {
    minZoom?: number;
    maxZoom?: number;
    /** Last word on every state change, e.g. to lock `y` or clamp to the map bounds. */
    constrain?: (next: TCameraState, prev: TCameraState) => TCameraState;
};

export type TCameraListener = (state: TCameraState, camera: Camera) => void;

/**
 * A pan/zoom camera that is independent of any canvas, so several renderers can follow one
 * instance: a `Scene` takes it in its constructor, and anything else (the legacy hex map, a
 * minimap) calls `subscribe` and reads `x`, `y`, `zoom` or `applyTo(ctx)`.
 */
export class Camera {
    private _state: TCameraState;
    private listeners = new Set<TCameraListener>();
    minZoom: number;
    maxZoom: number;
    constrain?: TCameraOptions['constrain'];

    constructor(options: TCameraOptions = {}) {
        this.minZoom = options.minZoom ?? 0.05;
        this.maxZoom = options.maxZoom ?? 20;
        this.constrain = options.constrain;
        this._state = this.normalize({ x: options.x ?? 0, y: options.y ?? 0, zoom: options.zoom ?? 1 }, undefined);
    }

    get x(): number {
        return this._state.x;
    }
    get y(): number {
        return this._state.y;
    }
    get zoom(): number {
        return this._state.zoom;
    }
    get state(): TCameraState {
        return { ...this._state };
    }

    /** Subscribe to every state change. Returns the unsubscribe function. */
    subscribe(listener: TCameraListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Sets any part of the state; notifies only when something actually changed. */
    set(patch: Partial<TCameraState>): void {
        const prev = this._state;
        const next = this.normalize({ ...prev, ...patch }, prev);
        if (next.x === prev.x && next.y === prev.y && next.zoom === prev.zoom) return;
        this._state = next;
        for (const l of [...this.listeners]) l(this.state, this);
    }

    /** Pans by a screen-pixel delta, the way content follows a dragging hand. */
    panByScreen(dx: number, dy: number): void {
        this.set({ x: this.x - dx / this.zoom, y: this.y - dy / this.zoom });
    }

    /** Moves the view by a world-unit delta. */
    panByWorld(dx: number, dy: number): void {
        this.set({ x: this.x + dx, y: this.y + dy });
    }

    /** Multiplies the zoom by `factor`, keeping the world point under `screenPoint` fixed. */
    zoomAt(screenPoint: TPoint, factor: number): void {
        this.setZoom(this.zoom * factor, screenPoint);
    }

    /** Sets an absolute zoom, keeping the world point under `screenPoint` (default: top-left) fixed. */
    setZoom(zoom: number, screenPoint: TPoint = { x: 0, y: 0 }): void {
        const clamped = this.clampZoom(zoom);
        const world = this.screenToWorld(screenPoint);
        this.set({ zoom: clamped, x: world.x - screenPoint.x / clamped, y: world.y - screenPoint.y / clamped });
    }

    /** Puts `world` in the middle of a viewport of the given size. */
    centerOn(world: TPoint, viewport: TSize): void {
        this.set({ x: world.x - viewport.width / 2 / this.zoom, y: world.y - viewport.height / 2 / this.zoom });
    }

    /** Zooms and pans so `rect` fits into the viewport with `padding` screen pixels around it. */
    fitRect(rect: TRect, viewport: TSize, padding = 20): void {
        const w = Math.max(1, viewport.width - padding * 2);
        const h = Math.max(1, viewport.height - padding * 2);
        const zoom = this.clampZoom(Math.min(w / Math.max(rect.width, 1e-6), h / Math.max(rect.height, 1e-6)));
        this.set({
            zoom,
            x: rect.x + rect.width / 2 - viewport.width / 2 / zoom,
            y: rect.y + rect.height / 2 - viewport.height / 2 / zoom,
        });
    }

    screenToWorld(p: TPoint): TPoint {
        return { x: this.x + p.x / this.zoom, y: this.y + p.y / this.zoom };
    }

    worldToScreen(p: TPoint): TPoint {
        return { x: (p.x - this.x) * this.zoom, y: (p.y - this.y) * this.zoom };
    }

    /** Converts a length in screen pixels to world units (e.g. a hit tolerance). */
    screenToWorldDistance(px: number): number {
        return px / this.zoom;
    }

    /** World rect currently visible in a viewport of the given size. */
    visibleRect(viewport: TSize): TRect {
        return { x: this.x, y: this.y, width: viewport.width / this.zoom, height: viewport.height / this.zoom };
    }

    /** Multiplies the context's current transform by the camera transform (world → screen). */
    applyTo(ctx: CanvasRenderingContext2D): void {
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.x, -this.y);
    }

    toJSON(): TCameraState {
        return this.state;
    }

    private clampZoom(zoom: number): number {
        return Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    }

    private normalize(next: TCameraState, prev: TCameraState | undefined): TCameraState {
        let s = { ...next, zoom: this.clampZoom(next.zoom) };
        if (this.constrain && prev) s = this.constrain(s, prev);
        return s;
    }
}
