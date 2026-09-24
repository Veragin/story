import { Observer, type TSize } from '@story/shared';
import {
    LAYER_ORDER,
    type IRenderer,
    type TDrawSpec,
    type TKeyEvent,
    type TLayerName,
    type TPointerEvent,
    type TViewportTransform,
} from './types';

/**
 * The test double behind the renderer port (VISUALIZER_PLAN §3.3).
 *
 * It records what it was asked to draw instead of drawing it, and exposes `emitPointer` /
 * `emitKey` so a test can drive a tool without synthesising DOM events. That is the whole
 * point of the port: tool state machines are where the bugs are, and they are testable here
 * without the native `canvas` package this repo declined to depend on.
 *
 * It is a *faithful* double, not a stub — `upsert` really does replace, `remove` really does
 * delete, `clearLayer` really does empty — so a test that passes here is testing the scene's
 * diffing, not the fake's forgiveness.
 */
export class FakeRenderer implements IRenderer {
    readonly specs = new Map<TLayerName, Map<string, TDrawSpec>>();
    /** Declared paint order per layer — what `idsOn` reports, rather than insertion order. */
    readonly order = new Map<TLayerName, string[]>();
    readonly cachedLayers = new Set<TLayerName>();

    container: HTMLElement | null = null;
    size: TSize = { width: 0, height: 0 };
    transform: TViewportTransform = { position: { x: 0, y: 0 }, scale: { width: 1, height: 1 } };
    cursor = 'default';
    destroyed = false;

    /** Counts of every call, so a test can assert "this did not redraw" as easily as "it did". */
    readonly calls = {
        mount: 0,
        resize: 0,
        setTransform: 0,
        upsert: 0,
        setOrder: 0,
        remove: 0,
        draw: 0,
        clearLayer: 0,
    };

    private readonly pointerObserver = new Observer<TPointerEvent>();
    private readonly keyObserver = new Observer<TKeyEvent>();

    constructor() {
        for (const layer of LAYER_ORDER) {
            this.specs.set(layer, new Map());
            this.order.set(layer, []);
        }
    }

    mount(container: HTMLElement, size: TSize): void {
        this.container = container;
        this.size = size;
        this.calls.mount++;
    }

    resize(size: TSize): void {
        this.size = size;
        this.calls.resize++;
    }

    setTransform(transform: TViewportTransform): void {
        this.transform = transform;
        this.calls.setTransform++;
    }

    upsert(layer: TLayerName, id: string, spec: TDrawSpec): void {
        this.specs.get(layer)!.set(id, spec);
        this.calls.upsert++;
    }

    setOrder(layer: TLayerName, ids: readonly string[]): void {
        this.order.set(
            layer,
            ids.filter((id) => this.specs.get(layer)!.has(id))
        );
        this.calls.setOrder++;
    }

    remove(layer: TLayerName, id: string): void {
        this.specs.get(layer)!.delete(id);
        this.order.set(
            layer,
            this.order.get(layer)!.filter((existing) => existing !== id)
        );
        this.calls.remove++;
    }

    clearLayer(layer: TLayerName): void {
        this.specs.get(layer)!.clear();
        this.order.set(layer, []);
        this.calls.clearLayer++;
    }

    setLayerCached(layer: TLayerName, cached: boolean): void {
        if (cached) this.cachedLayers.add(layer);
        else this.cachedLayers.delete(layer);
    }

    draw(): void {
        this.calls.draw++;
    }

    setCursor(cursor: string): void {
        this.cursor = cursor;
    }

    onPointer(handler: (event: TPointerEvent) => void): () => void {
        this.pointerObserver.subscribe(handler);
        return () => this.pointerObserver.unsubscribe(handler);
    }

    onKey(handler: (event: TKeyEvent) => void): () => void {
        this.keyObserver.subscribe(handler);
        return () => this.keyObserver.unsubscribe(handler);
    }

    destroy(): void {
        this.destroyed = true;
        this.container = null;
    }

    /* ------------------------------------------------------- test affordances */

    /** Feeds a pointer event into the scene. Only `type` and `world` are usually worth setting. */
    emitPointer(event: Partial<TPointerEvent> & Pick<TPointerEvent, 'type' | 'world'>): TPointerEvent {
        const full: TPointerEvent = {
            screen: event.screen ?? { x: 0, y: 0 },
            button: 0,
            buttons: event.type === 'down' || event.type === 'move' ? 1 : 0,
            shiftKey: false,
            ctrlKey: false,
            altKey: false,
            metaKey: false,
            preventDefault: () => {},
            ...event,
        };
        this.pointerObserver.notify(full);
        return full;
    }

    emitKey(event: Partial<TKeyEvent> & Pick<TKeyEvent, 'key'>): TKeyEvent {
        const full: TKeyEvent = {
            type: 'keydown',
            code: event.key,
            shiftKey: false,
            ctrlKey: false,
            altKey: false,
            metaKey: false,
            fromTextInput: false,
            preventDefault: () => {},
            ...event,
        };
        this.keyObserver.notify(full);
        return full;
    }

    /** The spec drawn for `id`, searching every layer. `undefined` when it is not drawn. */
    find(id: string): TDrawSpec | undefined {
        for (const layer of LAYER_ORDER) {
            const spec = this.specs.get(layer)!.get(id);
            if (spec) return spec;
        }
        return undefined;
    }

    /** Ids currently drawn on a layer, in paint order (bottom to top). */
    idsOn(layer: TLayerName): string[] {
        return [...this.order.get(layer)!];
    }
}
