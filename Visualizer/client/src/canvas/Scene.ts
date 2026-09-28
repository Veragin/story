import { Camera } from './Camera';
import { Emitter } from './Emitter';
import { rectsIntersect } from './geometry';
import { isTypingTarget } from './input';
import type { Shape } from './shapes/Shape';
import type { TRectEdge } from './shapes/RectShape';
import type { TPoint, TSize } from './types';

// ---------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------

export type TChangeKind = 'move' | 'resize' | 'vertex-move' | 'vertex-add' | 'vertex-remove';

export type TPointerInfo = { world: TPoint; screen: TPoint; client: TPoint };

export type TSceneEvents = {
    /** Selection changed (`shape` null = cleared). */
    select: { shape: Shape | null; previous: Shape | null };
    /**
     * A shape was edited by a controller. Drags emit `final: false` on every move and one
     * `final: true` at the end; one-shot edits (insert/remove vertex) are `final: true` only.
     * Save on `final`, or debounce the whole stream.
     */
    change: { shape: Shape; kind: TChangeKind; final: boolean; vertexIndex?: number; edge?: TRectEdge };
    /** Double-click on a shape (after its `onAction` ran). */
    action: TPointerInfo & { shape: Shape };
    /** The shape under the pointer changed (`shape` null = left every shape). */
    hover: TPointerInfo & { shape: Shape | null; previous: Shape | null };
    /** Every pointer move over the canvas while no button is pressed — for tooltips that follow the cursor. */
    pointermove: TPointerInfo & { shape: Shape | null };
    /** A tool created a shape and added it to the scene. */
    create: { shape: Shape; tool: string };
    add: { shape: Shape };
    remove: { shape: Shape };
    editable: { editable: boolean };
};

// ---------------------------------------------------------------------------------------------
// Interactions (controllers plug in here)
// ---------------------------------------------------------------------------------------------

export type TScenePointerEvent = TPointerInfo & {
    button: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    /** Topmost interactive shape under the pointer. */
    hit: Shape | null;
    /** Hit tolerance in world units (the scene's pixel tolerance at the current zoom). */
    tolerance: number;
    native: MouseEvent;
};

/**
 * A controller registered with `scene.addInteraction`. Handlers run in `priority` order
 * (highest first). Returning `true` from `onPointerDown` captures the gesture: that controller
 * alone gets the following `onPointerMove`/`onPointerUp`, and camera drag-panning is skipped.
 * If nobody captures, dragging pans the camera. A press released without moving is a click,
 * offered to `onClick` handlers in priority order until one returns `true`.
 */
export interface ISceneInteraction {
    priority?: number;
    onPointerDown?(e: TScenePointerEvent): boolean;
    onPointerMove?(e: TScenePointerEvent): void;
    onPointerUp?(e: TScenePointerEvent): void;
    /** Pointer moves while no button is pressed. */
    onHover?(e: TScenePointerEvent): void;
    onClick?(e: TScenePointerEvent): boolean;
    /** Returning `true` suppresses the shape's `onAction` and the `action` event. */
    onDoubleClick?(e: TScenePointerEvent): boolean;
    onContextMenu?(e: TScenePointerEvent): boolean;
    /** Already filtered: never called while typing in an input. Return `true` if handled. */
    onKeyDown?(e: KeyboardEvent): boolean;
    /** Cursor to show while hovering; the first defined answer wins. */
    getCursor?(e: TScenePointerEvent): string | undefined;
    /** Draw in world space after all layers (handles, highlights, previews). */
    drawOverlay?(ctx: CanvasRenderingContext2D, scene: Scene): void;
}

export type TDrawHook = (ctx: CanvasRenderingContext2D, scene: Scene) => void;

// ---------------------------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------------------------

export class Layer {
    readonly shapes: Shape[] = [];
    private _zIndex: number;
    private _visible = true;
    private _interactive = true;

    constructor(
        readonly name: string,
        private readonly scene: Scene,
        zIndex = 0
    ) {
        this._zIndex = zIndex;
    }

    get zIndex(): number {
        return this._zIndex;
    }
    set zIndex(z: number) {
        this._zIndex = z;
        this.scene.markOrderDirty();
        this.scene.invalidate();
    }
    get visible(): boolean {
        return this._visible;
    }
    set visible(v: boolean) {
        this._visible = v;
        this.scene.invalidate();
    }
    /** When false, shapes are drawn but never hit-tested. */
    get interactive(): boolean {
        return this._interactive;
    }
    set interactive(v: boolean) {
        this._interactive = v;
    }
}

// ---------------------------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------------------------

export type TSceneOptions = {
    /** Pass a shared camera to have several renderers follow one view. Default: a new one. */
    camera?: Camera;
    /** Default true. False = view mode: controllers stop editing; hover, double-click and camera still work. */
    editable?: boolean;
    /** Canvas background; transparent (cleared) when omitted, so a scene can sit over another canvas. */
    background?: string;
    /** WASD/arrow panning. Default true. */
    keyboardPan?: boolean;
    /** Keyboard pan speed in screen px per second. Default 600. */
    panSpeed?: number;
    /** Drag on empty space (or with the middle button) pans. Default true. */
    dragPan?: boolean;
    /** Wheel zooms at the cursor. Default true. */
    wheelZoom?: boolean;
    /** Wheel zoom sensitivity. Default 0.0015 (per deltaY pixel). */
    wheelSensitivity?: number;
    /** Pointer travel (px) below which a press counts as a click. Default 4. */
    clickTolerance?: number;
    /** Hit-test slack in screen px. Default 4. */
    hitTolerance?: number;
    /** Default `window.devicePixelRatio`. */
    pixelRatio?: number;
    /** Track the canvas CSS size with a ResizeObserver (or window resize). Default true. */
    autoResize?: boolean;
    /** Where keyboard listeners go. Default `window`. */
    keyboardTarget?: Window | HTMLElement;
};

const PAN_KEYS: Record<string, TPoint> = {
    KeyW: { x: 0, y: -1 },
    ArrowUp: { x: 0, y: -1 },
    KeyS: { x: 0, y: 1 },
    ArrowDown: { x: 0, y: 1 },
    KeyA: { x: -1, y: 0 },
    ArrowLeft: { x: -1, y: 0 },
    KeyD: { x: 1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
};

type TPress = {
    button: number;
    start: TPoint;
    last: TPoint;
    moved: boolean;
    captured: ISceneInteraction | null;
    panning: boolean;
};

/**
 * Owns one `<canvas>`: layers of shapes, a camera, input dispatch and a redraw-on-demand loop.
 * Rendering happens only after `invalidate()` (called by shapes, the camera and controllers),
 * at most once per animation frame. `destroy()` removes every listener, frame and observer.
 */
export class Scene {
    readonly canvas: HTMLCanvasElement;
    readonly camera: Camera;
    readonly events = new Emitter<TSceneEvents>();
    readonly ctx: CanvasRenderingContext2D | null;

    background?: string;
    dragPan: boolean;
    wheelZoom: boolean;
    panSpeed: number;
    wheelSensitivity: number;
    clickTolerance: number;
    hitTolerance: number;
    keyboardPan: boolean;

    private _editable: boolean;
    private readonly layers = new Map<string, Layer>();
    private sortedLayers: Layer[] = [];
    private orderDirty = true;
    private interactions: ISceneInteraction[] = [];
    private hooks = { before: [] as TDrawHook[], after: [] as TDrawHook[], screen: [] as TDrawHook[] };
    private frame: number | null = null;
    private dirty = true;
    private destroyed = false;
    private pixelRatio: number;
    private press: TPress | null = null;
    private heldKeys = new Set<string>();
    private lastTick: number | null = null;
    private hovered: Shape | null = null;
    private lastPointer: TPointerInfo | null = null;
    private cleanups: (() => void)[] = [];
    private resizeObserver: ResizeObserver | null = null;
    private cssSize: TSize = { width: 0, height: 0 };

    constructor(canvas: HTMLCanvasElement, options: TSceneOptions = {}) {
        this.canvas = canvas;
        this.camera = options.camera ?? new Camera();
        this._editable = options.editable ?? true;
        this.background = options.background;
        this.dragPan = options.dragPan ?? true;
        this.wheelZoom = options.wheelZoom ?? true;
        this.panSpeed = options.panSpeed ?? 600;
        this.wheelSensitivity = options.wheelSensitivity ?? 0.0015;
        this.clickTolerance = options.clickTolerance ?? 4;
        this.hitTolerance = options.hitTolerance ?? 4;
        this.keyboardPan = options.keyboardPan ?? true;
        this.pixelRatio = options.pixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
        let ctx: CanvasRenderingContext2D | null = null;
        try {
            ctx = canvas.getContext('2d');
        } catch {
            ctx = null; // jsdom without the test stub: logic works, drawing is a no-op
        }
        this.ctx = ctx;
        this.layer('default');

        this.cleanups.push(this.camera.subscribe(() => this.invalidate()));
        this.listen(canvas, 'pointerdown', this.handlePointerDown);
        this.listen(canvas, 'pointermove', this.handleCanvasPointerMove);
        this.listen(canvas, 'pointerleave', this.handlePointerLeave);
        this.listen(canvas, 'dblclick', this.handleDoubleClick);
        this.listen(canvas, 'contextmenu', this.handleContextMenu);
        this.listen(canvas, 'wheel', this.handleWheel, { passive: false });
        const keyTarget = options.keyboardTarget ?? window;
        this.listen(keyTarget, 'keydown', this.handleKeyDown);
        this.listen(keyTarget, 'keyup', this.handleKeyUp);
        this.listen(window, 'blur', this.handleBlur);
        if (canvas.style.touchAction === '') canvas.style.touchAction = 'none';

        if (options.autoResize ?? true) {
            if (typeof ResizeObserver !== 'undefined') {
                this.resizeObserver = new ResizeObserver(() => this.resize());
                this.resizeObserver.observe(canvas);
            } else {
                this.listen(window, 'resize', () => this.resize());
            }
        }
        this.resize();
    }

    // ---- state -------------------------------------------------------------------------------

    get editable(): boolean {
        return this._editable;
    }
    set editable(value: boolean) {
        if (value === this._editable) return;
        this._editable = value;
        this.events.emit('editable', { editable: value });
        this.invalidate();
    }

    /** Canvas size in CSS pixels. */
    get size(): TSize {
        return { ...this.cssSize };
    }

    get hoveredShape(): Shape | null {
        return this.hovered;
    }

    /** Syncs the backing store with the canvas CSS size (or the given size) and redraws. */
    resize(size?: TSize): void {
        const width = size?.width ?? this.canvas.clientWidth;
        const height = size?.height ?? this.canvas.clientHeight;
        this.cssSize = { width, height };
        const w = Math.round(width * this.pixelRatio);
        const h = Math.round(height * this.pixelRatio);
        if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        this.invalidate();
    }

    // ---- layers and shapes -------------------------------------------------------------------

    /** Gets a layer, creating it (with `zIndex`) the first time. */
    layer(name: string, zIndex?: number): Layer {
        let layer = this.layers.get(name);
        if (!layer) {
            layer = new Layer(name, this, zIndex ?? this.layers.size);
            this.layers.set(name, layer);
            this.orderDirty = true;
        } else if (zIndex !== undefined && layer.zIndex !== zIndex) {
            layer.zIndex = zIndex;
        }
        return layer;
    }

    getLayers(): Layer[] {
        return [...this.orderedLayers()];
    }

    add<T extends Shape>(shape: T, layerName = 'default'): T {
        if (shape.host && shape.host !== this) throw new Error(`Shape ${shape.id} already belongs to another scene`);
        if (shape.host === this) this.remove(shape);
        this.layer(layerName).shapes.push(shape);
        shape.host = this;
        shape.layerName = layerName;
        this.orderDirty = true;
        this.events.emit('add', { shape });
        this.invalidate();
        return shape;
    }

    remove(shape: Shape): void {
        if (shape.host !== this || !shape.layerName) return;
        const layer = this.layers.get(shape.layerName);
        const i = layer?.shapes.indexOf(shape) ?? -1;
        if (layer && i >= 0) layer.shapes.splice(i, 1);
        shape.host = null;
        shape.layerName = null;
        shape.hovered = false;
        if (this.hovered === shape) this.hovered = null;
        this.events.emit('remove', { shape });
        this.invalidate();
    }

    /** Removes every shape (of one layer, or of all). */
    clear(layerName?: string): void {
        const layers = layerName ? [this.layers.get(layerName)].filter(Boolean) : [...this.layers.values()];
        for (const layer of layers as Layer[]) for (const s of [...layer.shapes]) this.remove(s);
    }

    getShape(id: string): Shape | undefined {
        for (const layer of this.layers.values()) {
            const s = layer.shapes.find((sh) => sh.id === id);
            if (s) return s;
        }
        return undefined;
    }

    /** All shapes in draw order (bottom first). */
    getShapes(): Shape[] {
        return this.orderedLayers().flatMap((l) => l.shapes);
    }

    has(shape: Shape): boolean {
        return shape.host === this;
    }

    /** Topmost visible, interactive shape at a world point. */
    hitTest(world: TPoint, filter?: (s: Shape) => boolean): Shape | null {
        const tol = this.camera.screenToWorldDistance(this.hitTolerance);
        const layers = this.orderedLayers();
        for (let li = layers.length - 1; li >= 0; li--) {
            const layer = layers[li];
            if (!layer.visible || !layer.interactive) continue;
            for (let i = layer.shapes.length - 1; i >= 0; i--) {
                const s = layer.shapes[i];
                if (!s.visible || !s.interactive) continue;
                if (filter && !filter(s)) continue;
                if (s.hitTest(world, tol)) return s;
            }
        }
        return null;
    }

    markOrderDirty(): void {
        this.orderDirty = true;
    }

    private orderedLayers(): Layer[] {
        if (this.orderDirty) {
            this.sortedLayers = [...this.layers.values()].sort((a, b) => a.zIndex - b.zIndex);
            for (const l of this.sortedLayers) {
                // Array.prototype.sort is stable, so equal zIndex keeps insertion order.
                l.shapes.sort((a, b) => a.zIndex - b.zIndex);
            }
            this.orderDirty = false;
        }
        return this.sortedLayers;
    }

    // ---- interactions and hooks --------------------------------------------------------------

    /** Registers a controller. Returns the function that removes it again. */
    addInteraction(interaction: ISceneInteraction): () => void {
        this.interactions.push(interaction);
        this.interactions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        this.invalidate();
        return () => {
            this.interactions = this.interactions.filter((i) => i !== interaction);
            if (this.press?.captured === interaction) this.press.captured = null;
            this.invalidate();
        };
    }

    /**
     * Custom drawing. `before`/`after` run in world space before or after the layers
     * (`after` still runs below the controller overlays); `screen` runs last in CSS pixels.
     */
    addDrawHook(hook: TDrawHook, phase: 'before' | 'after' | 'screen' = 'after'): () => void {
        this.hooks[phase].push(hook);
        this.invalidate();
        return () => {
            this.hooks[phase] = this.hooks[phase].filter((h) => h !== hook);
            this.invalidate();
        };
    }

    // ---- coordinates -------------------------------------------------------------------------

    clientToScreen(clientX: number, clientY: number): TPoint {
        const r = this.canvas.getBoundingClientRect();
        return { x: clientX - r.left, y: clientY - r.top };
    }

    screenToWorld(p: TPoint): TPoint {
        return this.camera.screenToWorld(p);
    }

    worldToScreen(p: TPoint): TPoint {
        return this.camera.worldToScreen(p);
    }

    /** Centers the camera on a world point. */
    centerOn(world: TPoint): void {
        this.camera.centerOn(world, this.cssSize);
    }

    /** World point at the middle of the view (e.g. where to put a newly added shape). */
    viewCenter(): TPoint {
        return this.camera.screenToWorld({ x: this.cssSize.width / 2, y: this.cssSize.height / 2 });
    }

    // ---- rendering ---------------------------------------------------------------------------

    /** Schedules a redraw on the next animation frame (coalesced). */
    invalidate(): void {
        this.dirty = true;
        this.schedule();
    }

    private schedule(): void {
        if (this.destroyed || this.frame !== null) return;
        this.frame = requestAnimationFrame(this.tick);
    }

    private tick = (time: number): void => {
        this.frame = null;
        if (this.destroyed) return;
        if (this.heldKeys.size > 0) {
            const dt = this.lastTick === null ? 1 / 60 : Math.min(0.1, (time - this.lastTick) / 1000);
            this.lastTick = time;
            this.applyKeyboardPan(dt);
            this.schedule();
        } else {
            this.lastTick = null;
        }
        if (this.dirty) this.renderNow();
    };

    private applyKeyboardPan(dt: number): void {
        let dx = 0;
        let dy = 0;
        for (const code of this.heldKeys) {
            dx += PAN_KEYS[code].x;
            dy += PAN_KEYS[code].y;
        }
        if (dx === 0 && dy === 0) return;
        const step = (this.panSpeed * dt) / this.camera.zoom;
        this.camera.panByWorld(Math.sign(dx) * step, Math.sign(dy) * step);
    }

    /** Draws synchronously. Normally called by the frame loop; handy in tests. */
    renderNow(): void {
        this.dirty = false;
        const ctx = this.ctx;
        if (!ctx) return;
        const dpr = this.pixelRatio;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (this.background) {
            ctx.fillStyle = this.background;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.save();
        this.camera.applyTo(ctx);
        for (const h of this.hooks.before) h(ctx, this);
        const zoom = this.camera.zoom;
        const visible = this.camera.visibleRect(this.cssSize);
        const cull = visible.width > 0 && visible.height > 0;
        // Slack so strokes, labels and arrowheads just outside the view are not culled.
        const slack = 50 / zoom;
        const view = {
            x: visible.x - slack,
            y: visible.y - slack,
            width: visible.width + slack * 2,
            height: visible.height + slack * 2,
        };
        for (const layer of this.orderedLayers()) {
            if (!layer.visible) continue;
            for (const shape of layer.shapes) {
                if (!shape.visible) continue;
                if (cull && !rectsIntersect(shape.getBounds(), view)) continue;
                shape.draw(ctx, { camera: this.camera, zoom, hovered: shape === this.hovered });
            }
        }
        for (const h of this.hooks.after) h(ctx, this);
        for (const i of this.interactions) i.drawOverlay?.(ctx, this);
        ctx.restore();
        for (const h of this.hooks.screen) h(ctx, this);
    }

    // ---- input -------------------------------------------------------------------------------

    private listen<K extends string>(
        target: EventTarget,
        type: K,
        handler: (e: never) => void,
        options?: AddEventListenerOptions
    ): void {
        const fn = handler as unknown as EventListener;
        target.addEventListener(type, fn, options);
        this.cleanups.push(() => target.removeEventListener(type, fn, options));
    }

    private toPointerEvent(e: MouseEvent, withHit = true): TScenePointerEvent {
        const screen = this.clientToScreen(e.clientX, e.clientY);
        const world = this.camera.screenToWorld(screen);
        return {
            screen,
            world,
            client: { x: e.clientX, y: e.clientY },
            button: e.button,
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
            hit: withHit ? this.hitTest(world) : null,
            tolerance: this.camera.screenToWorldDistance(this.hitTolerance),
            native: e,
        };
    }

    private handlePointerDown = (e: PointerEvent): void => {
        if (this.press) return;
        if (e.button === 2) return; // right button → contextmenu handler
        const pe = this.toPointerEvent(e);
        let captured: ISceneInteraction | null = null;
        if (e.button === 0) {
            for (const i of this.interactions) {
                if (i.onPointerDown?.(pe)) {
                    captured = i;
                    break;
                }
            }
        }
        const panning = !captured && this.dragPan && (e.button === 0 || e.button === 1);
        if (!captured && !panning) return;
        // No text selection while dragging, no middle-button autoscroll. That also stops the press
        // from moving focus, so blur a focused form field by hand: otherwise keyboard panning
        // would stay disabled after clicking from an input into the canvas.
        e.preventDefault();
        const active = document.activeElement;
        if (active instanceof HTMLElement && isTypingTarget(active)) active.blur();
        this.press = { button: e.button, start: pe.screen, last: pe.screen, moved: false, captured, panning };
        // Follow the gesture outside the canvas; removed on up/cancel/destroy.
        window.addEventListener('pointermove', this.handleWindowPointerMove);
        window.addEventListener('pointerup', this.handleWindowPointerUp);
        window.addEventListener('pointercancel', this.handleWindowPointerUp);
        this.setCursor(captured ? this.canvas.style.cursor : 'grabbing');
    };

    private handleWindowPointerMove = (e: PointerEvent): void => {
        const press = this.press;
        if (!press) return;
        const pe = this.toPointerEvent(e, false);
        if (
            !press.moved &&
            Math.hypot(pe.screen.x - press.start.x, pe.screen.y - press.start.y) > this.clickTolerance
        ) {
            press.moved = true;
        }
        if (press.captured) {
            press.captured.onPointerMove?.(pe);
        } else if (press.panning && press.moved) {
            this.camera.panByScreen(pe.screen.x - press.last.x, pe.screen.y - press.last.y);
        }
        press.last = pe.screen;
    };

    private handleWindowPointerUp = (e: PointerEvent): void => {
        const press = this.press;
        if (!press) return;
        this.endPress();
        const pe = this.toPointerEvent(e);
        press.captured?.onPointerUp?.(pe);
        if (!press.moved && press.button === 0 && e.type === 'pointerup') {
            for (const i of this.interactions) if (i.onClick?.(pe)) break;
        }
        this.updateHover(pe);
    };

    private endPress(): void {
        this.press = null;
        window.removeEventListener('pointermove', this.handleWindowPointerMove);
        window.removeEventListener('pointerup', this.handleWindowPointerUp);
        window.removeEventListener('pointercancel', this.handleWindowPointerUp);
    }

    private handleCanvasPointerMove = (e: PointerEvent): void => {
        if (this.press) return; // handled by the window listener
        const pe = this.toPointerEvent(e);
        for (const i of this.interactions) i.onHover?.(pe);
        this.updateHover(pe);
    };

    private updateHover(pe: TScenePointerEvent): void {
        const info: TPointerInfo = { world: pe.world, screen: pe.screen, client: pe.client };
        this.lastPointer = info;
        const shape = pe.hit;
        if (shape !== this.hovered) {
            const previous = this.hovered;
            if (previous) previous.hovered = false;
            if (shape) shape.hovered = true;
            this.hovered = shape;
            this.events.emit('hover', { ...info, shape, previous });
            if (previous?.hoverStyle || shape?.hoverStyle) this.invalidate();
        }
        this.events.emit('pointermove', { ...info, shape });
        let cursor: string | undefined;
        for (const i of this.interactions) {
            cursor = i.getCursor?.(pe);
            if (cursor) break;
        }
        this.setCursor(cursor ?? shape?.cursor ?? 'default');
    }

    private handlePointerLeave = (): void => {
        if (this.press) return;
        if (this.hovered) {
            const previous = this.hovered;
            previous.hovered = false;
            this.hovered = null;
            const info = this.lastPointer ?? { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, client: { x: 0, y: 0 } };
            this.events.emit('hover', { ...info, shape: null, previous });
            if (previous.hoverStyle) this.invalidate();
        }
        this.setCursor('default');
    };

    private handleDoubleClick = (e: MouseEvent): void => {
        const pe = this.toPointerEvent(e);
        for (const i of this.interactions) if (i.onDoubleClick?.(pe)) return;
        const shape = pe.hit;
        if (!shape) return;
        shape.onAction?.(shape);
        this.events.emit('action', { shape, world: pe.world, screen: pe.screen, client: pe.client });
    };

    private handleContextMenu = (e: MouseEvent): void => {
        e.preventDefault();
        const pe = this.toPointerEvent(e);
        for (const i of this.interactions) if (i.onContextMenu?.(pe)) return;
    };

    private handleWheel = (e: WheelEvent): void => {
        if (!this.wheelZoom) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        const delta = Math.max(-300, Math.min(300, e.deltaY * unit));
        if (delta === 0) return;
        const factor = Math.exp(-delta * this.wheelSensitivity);
        this.camera.zoomAt(this.clientToScreen(e.clientX, e.clientY), factor);
    };

    private handleKeyDown = (e: KeyboardEvent): void => {
        if (isTypingTarget(e.target)) return;
        for (const i of this.interactions) {
            if (i.onKeyDown?.(e)) {
                e.preventDefault();
                return;
            }
        }
        if (!this.keyboardPan || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!(e.code in PAN_KEYS)) return;
        e.preventDefault();
        this.heldKeys.add(e.code);
        this.schedule();
    };

    private handleKeyUp = (e: KeyboardEvent): void => {
        this.heldKeys.delete(e.code);
    };

    private handleBlur = (): void => {
        this.heldKeys.clear();
    };

    private setCursor(cursor: string): void {
        if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
    }

    // ---- teardown ----------------------------------------------------------------------------

    get isDestroyed(): boolean {
        return this.destroyed;
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.endPress();
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        for (const c of this.cleanups.splice(0)) c();
        for (const layer of this.layers.values()) {
            for (const s of layer.shapes) {
                s.host = null;
                s.layerName = null;
                s.hovered = false;
            }
            layer.shapes.length = 0;
        }
        this.interactions = [];
        this.heldKeys.clear();
        this.events.clear();
    }
}
