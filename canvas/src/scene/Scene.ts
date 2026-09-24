import { Observer, type TBBox, type TPoint } from '@story/shared';
import { bboxContains, bboxIntersects, isEmptyBBox, unionBBox } from '../geometry/polygon';
import { LAYER_ORDER, type IRenderer, type TKeyEvent, type TLayerName, type TPointerEvent } from '../renderer/types';
import { Layers } from './Layers';
import type { SceneObject, TObjectChange } from './SceneObject';
import { Viewport, type TViewportOptions } from './Viewport';

/**
 * A canvas scene: a viewport, an object index, a renderer and the input plumbing between them
 * (VISUALIZER_PLAN §3.2).
 *
 * `Scene` is deliberately ignorant of tools. It knows how to hold objects, draw them, and route
 * a normalised pointer event; `ToolManager` (Phase 2) is what turns that event into an edit.
 * Keeping the split means the scene can be tested without a tool and a tool without a scene
 * bigger than a stub.
 *
 * Redraw is **coalesced through `requestAnimationFrame`**, not throttled on a timer the way the
 * engine this replaces did. A timer redraws at 60 Hz whether or not the browser is ready to
 * paint and keeps firing in a background tab; rAF does neither. Where no rAF exists (the `node`
 * test environment) it falls back to a microtask, so a test can `await scene.flush()` and get a
 * deterministic draw without waiting on a clock.
 */

export type TSceneOptions = {
    renderer: IRenderer;
    viewport?: TViewportOptions | Viewport;
    /**
     * Click slop in *screen pixels*, converted to world units at the current zoom on every hit
     * test. A constant world tolerance would make thin objects unclickable when zoomed out and
     * greedily clickable when zoomed in.
     */
    hitTolerance?: number;
};

export class Scene {
    readonly viewport: Viewport;
    readonly layers = new Layers();
    private readonly renderer: IRenderer;
    private readonly hitTolerance: number;

    /** Re-emitted object mutations, so a store can subscribe once instead of per object. */
    readonly onObjectChanged = new Observer<TObjectChange>();
    readonly onPointer = new Observer<TPointerEvent>();
    readonly onKey = new Observer<TKeyEvent>();

    private container: HTMLElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private unsubscribers: (() => void)[] = [];
    private destroyed = false;

    /** Ids currently drawn, per layer — the diff base for removing what went away. */
    private readonly drawn = new Map<TLayerName, Set<string>>();

    private frameHandle: number | null = null;
    private pendingFlush: Promise<void> | null = null;
    private resolveFlush: (() => void) | null = null;

    constructor(options: TSceneOptions) {
        this.renderer = options.renderer;
        this.hitTolerance = options.hitTolerance ?? 4;
        this.viewport = options.viewport instanceof Viewport ? options.viewport : new Viewport(options.viewport ?? {});

        for (const layer of LAYER_ORDER) this.drawn.set(layer, new Set());

        this.viewport.onChange.subscribe(this.handleViewportChange);
        this.layers.onAdded.subscribe(this.handleObjectAdded);
        this.layers.onRemoved.subscribe(this.handleObjectRemoved);
    }

    /* ----------------------------------------------------------- lifecycle */

    /**
     * Attaches to a DOM element and starts tracking its size.
     *
     * The `ResizeObserver` — not a window `resize` listener — because the Visualizer's canvases
     * live inside splitters and collapsing panels that resize without the window ever doing so.
     */
    mount(container: HTMLElement): void {
        if (this.destroyed) throw new Error('Cannot mount a destroyed Scene');
        this.container = container;

        const size = { width: container.clientWidth, height: container.clientHeight };
        this.viewport.setSize(size);
        this.renderer.mount(container, size);

        this.unsubscribers.push(this.renderer.onPointer(this.handlePointer));
        this.unsubscribers.push(this.renderer.onKey(this.handleKey));

        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.syncSize());
            this.resizeObserver.observe(container);
        }

        this.renderer.setTransform(this.viewport.transform);
        this.requestDraw();
    }

    /** Re-reads the container's size. Exposed for hosts that resize imperatively. */
    syncSize(): void {
        if (!this.container) return;
        const size = { width: this.container.clientWidth, height: this.container.clientHeight };
        if (size.width === this.viewport.size.width && size.height === this.viewport.size.height) return;
        this.viewport.setSize(size);
        this.renderer.resize(size);
        this.requestDraw();
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;

        if (this.frameHandle !== null) cancelFrame(this.frameHandle);
        this.frameHandle = null;
        this.resolveFlush?.();
        this.resolveFlush = null;
        this.pendingFlush = null;

        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        for (const unsubscribe of this.unsubscribers) unsubscribe();
        this.unsubscribers = [];

        for (const object of this.layers.all()) object.onChange.unsubscribe(this.handleObjectChange);
        this.layers.clear();
        this.renderer.destroy();
        this.container = null;
    }

    /* -------------------------------------------------------------- objects */

    add<T extends SceneObject>(object: T): T {
        this.layers.add(object);
        return object;
    }

    addAll(objects: readonly SceneObject[]): void {
        for (const object of objects) this.add(object);
    }

    remove(object: SceneObject): void {
        this.layers.remove(object);
    }

    /** Removes every object matching `predicate`. Returns how many went. */
    removeWhere(predicate: (object: SceneObject) => boolean): number {
        const doomed = this.layers.all().filter(predicate);
        for (const object of doomed) this.layers.remove(object);
        return doomed.length;
    }

    get(id: string): SceneObject | undefined {
        return this.layers.get(id);
    }

    all(): SceneObject[] {
        return this.layers.all();
    }

    clear(): void {
        for (const object of this.layers.all()) object.onChange.unsubscribe(this.handleObjectChange);
        this.layers.clear();
        for (const layer of LAYER_ORDER) {
            this.renderer.clearLayer(layer);
            this.drawn.get(layer)!.clear();
        }
        this.requestDraw();
    }

    /* --------------------------------------------------------- hit testing */

    /** Current click slop in world units — a screen-pixel constant divided by the zoom. */
    get worldTolerance(): number {
        return this.viewport.screenLengthToWorld(this.hitTolerance);
    }

    /**
     * The topmost object under `world`, or `undefined`. `filter` is how a tool restricts itself
     * to the kind of thing it edits without re-implementing the walk.
     */
    hitTest(world: TPoint, filter?: (object: SceneObject) => boolean): SceneObject | undefined {
        const tolerance = this.worldTolerance;
        for (const object of this.layers.hitOrder()) {
            if (!object.visible) continue;
            if (filter && !filter(object)) continue;
            if (object.hitTest(world, tolerance)) return object;
        }
        return undefined;
    }

    /** Every object under `world`, topmost first. */
    hitTestAll(world: TPoint, filter?: (object: SceneObject) => boolean): SceneObject[] {
        const tolerance = this.worldTolerance;
        return this.layers
            .hitOrder()
            .filter((object) => object.visible && (!filter || filter(object)) && object.hitTest(world, tolerance));
    }

    /**
     * Objects inside a marquee. `mode: 'contain'` (the default) takes only what lies wholly
     * inside, which is the behaviour every drawing tool has trained people to expect;
     * `'intersect'` takes anything the box touches.
     */
    hitTestBox(box: TBBox, mode: 'contain' | 'intersect' = 'contain'): SceneObject[] {
        const test = mode === 'contain' ? bboxContains : bboxIntersects;
        return this.layers.all().filter((object) => object.visible && object.selectable && test(box, object.bounds));
    }

    /** Union of every visible object's bounds — the argument `fitToContent` passes to `fit`. */
    get contentBounds(): TBBox {
        let box: TBBox = { min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } };
        for (const object of this.layers.all()) {
            if (!object.visible) continue;
            if (object.layer === 'overlay' || object.layer === 'interaction') continue;
            box = unionBBox(box, object.bounds);
        }
        return box;
    }

    /** Zooms and pans to show everything. A no-op on an empty scene rather than a jump to 0,0. */
    fitToContent(padding = 40): void {
        const box = this.contentBounds;
        if (isEmptyBBox(box)) return;
        this.viewport.fit(box, padding);
    }

    /* ------------------------------------------------------------ rendering */

    setCursor(cursor: string): void {
        this.renderer.setCursor(cursor);
    }

    /**
     * Marks a layer as cached to an offscreen bitmap. Phase 0's spike 2 (Konva at 500 polygons
     * plus 2 000 brush points) could not be run headlessly, so §7's stated fallback is taken up
     * front: the map tab caches its brush layer, which is the heavy, non-interactive one.
     */
    setLayerCached(layer: TLayerName, cached: boolean): void {
        this.renderer.setLayerCached(layer, cached);
    }

    /** Schedules a redraw. Cheap and idempotent — call it whenever anything might have changed. */
    requestDraw(): void {
        if (this.destroyed || this.frameHandle !== null) return;
        this.frameHandle = requestFrame(() => {
            this.frameHandle = null;
            this.draw();
            const resolve = this.resolveFlush;
            this.resolveFlush = null;
            this.pendingFlush = null;
            resolve?.();
        });
    }

    /**
     * Resolves after the next draw. The handle tests use instead of a timer — and the reason
     * `requestDraw` bothers to keep a promise around.
     */
    flush(): Promise<void> {
        if (this.destroyed) return Promise.resolve();
        if (!this.pendingFlush) {
            this.pendingFlush = new Promise<void>((resolve) => {
                this.resolveFlush = resolve;
            });
            this.requestDraw();
        }
        return this.pendingFlush;
    }

    /** Draws immediately, bypassing the frame coalescing. */
    draw(): void {
        if (this.destroyed) return;

        for (const layer of LAYER_ORDER) {
            const present = new Set<string>();
            // Built in paint order, so it doubles as the argument to `setOrder` below.
            const order: string[] = [];
            for (const object of this.layers.sorted(layer)) {
                if (!object.visible) continue;
                present.add(object.id);
                order.push(object.id);
                this.renderer.upsert(layer, object.id, object.toSpec());
            }

            const drawn = this.drawn.get(layer)!;
            for (const id of drawn) {
                if (!present.has(id)) this.renderer.remove(layer, id);
            }
            this.drawn.set(layer, present);

            // After the removals: an id that just left must not be named in the order.
            this.renderer.setOrder(layer, order);
        }

        this.renderer.draw();
    }

    /* --------------------------------------------------------------- input */

    private handlePointer = (event: TPointerEvent): void => {
        this.onPointer.notify(event);
    };

    private handleKey = (event: TKeyEvent): void => {
        this.onKey.notify(event);
    };

    private handleViewportChange = (): void => {
        this.renderer.setTransform(this.viewport.transform);
        this.requestDraw();
    };

    private handleObjectAdded = (object: SceneObject): void => {
        object.onChange.subscribe(this.handleObjectChange);
        this.requestDraw();
    };

    private handleObjectRemoved = (object: SceneObject): void => {
        object.onChange.unsubscribe(this.handleObjectChange);
        this.renderer.remove(object.layer, object.id);
        this.drawn.get(object.layer)?.delete(object.id);
        this.requestDraw();
    };

    private handleObjectChange = (change: TObjectChange): void => {
        // `z` and `layer` change paint order, which the per-layer sort caches.
        if (change.property === 'z') this.layers.invalidateOrder(change.object.layer);
        this.onObjectChanged.notify(change);
        this.requestDraw();
    };
}

/**
 * rAF where there is one, a microtask where there is not. The `node` Vitest environment has no
 * rAF, and a `setTimeout` fallback would make every scene test wait on a real clock.
 */
const requestFrame = (callback: () => void): number => {
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
    queueMicrotask(callback);
    return -1;
};

const cancelFrame = (handle: number): void => {
    if (handle >= 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
};
