import { Observer, type TPoint, type TSize } from '@story/shared';
import Konva from 'konva/lib/Core';
import { Arrow } from 'konva/lib/shapes/Arrow';
import { Circle } from 'konva/lib/shapes/Circle';
import { Image as KonvaImage } from 'konva/lib/shapes/Image';
import { Line } from 'konva/lib/shapes/Line';
import { Rect } from 'konva/lib/shapes/Rect';
import { Text } from 'konva/lib/shapes/Text';
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
 * The production renderer: Konva behind the port (VISUALIZER_PLAN §2, §3.3).
 *
 * Three decisions worth reading before changing anything here.
 *
 * **Konva's event system is not used.** Every layer is `listening(false)` and the DOM listeners
 * are on the container. Hit-testing lives in `SceneObject.hitTest`, in world units, so that the
 * fake renderer can run the same tools (see `types.ts`). Switching the hit graph off is not a
 * loss, it is most of why a map with hundreds of polygons stays responsive: Konva's hit graph
 * is a second full render into an offscreen canvas, and we were not going to read it.
 *
 * **Sub-imports, not `import Konva from 'konva'`.** The barrel drags in every shape, filter and
 * the `Transformer`; this pulls the six shapes actually used. `konva/lib/Core` is the documented
 * tree-shaking entry and carries `Stage`/`Layer`/`Group`.
 *
 * **Nodes are reconciled, not rebuilt.** `upsert` keeps a node per id and sets attributes on it.
 * Rebuilding on every frame would garbage a few hundred objects per drag; the only time a node
 * is destroyed is when its `kind` changes, which in practice never happens.
 */

/** Konva node types this renderer creates, keyed the way the reconciler compares them. */
type TManaged = {
    kind: TDrawSpec['kind'];
    node: Konva.Node;
};

/** How long the transform must be still before a cached layer re-caches. */
const RECACHE_IDLE_MS = 180;

export class KonvaRenderer implements IRenderer {
    private stage: Konva.Stage | null = null;
    private container: HTMLElement | null = null;
    private readonly layers = new Map<TLayerName, Konva.Layer>();
    private readonly nodes = new Map<TLayerName, Map<string, TManaged>>();
    /** Last order actually applied per layer, so `setOrder` can no-op on the common case. */
    private readonly appliedOrder = new Map<TLayerName, string[]>();

    private transform: TViewportTransform = {
        position: { x: 0, y: 0 },
        scale: { width: 1, height: 1 },
    };

    private readonly pointerObserver = new Observer<TPointerEvent>();
    private readonly keyObserver = new Observer<TKeyEvent>();

    private readonly cachedLayers = new Set<TLayerName>();
    private recacheTimer: ReturnType<typeof setTimeout> | null = null;

    /** Images are shared by src: a map that shows the same icon 200 times decodes it once. */
    private readonly images = new Map<string, HTMLImageElement>();
    private pendingImageDraw = false;

    private destroyed = false;

    constructor() {
        for (const layer of LAYER_ORDER) this.nodes.set(layer, new Map());
    }

    /* ----------------------------------------------------------- lifecycle */

    mount(container: HTMLElement, size: TSize): void {
        this.container = container;
        this.stage = new Konva.Stage({
            // Konva's typings narrow this to `HTMLDivElement`, but the implementation only ever
            // calls `appendChild`/`style` on it. Widening the parameter to `HTMLElement` is what
            // lets a host pass a `<section>` without a cast at every call site.
            container: container as HTMLDivElement,
            width: Math.max(1, size.width),
            height: Math.max(1, size.height),
        });

        for (const name of LAYER_ORDER) {
            const layer = new Konva.Layer({ listening: false });
            this.stage.add(layer);
            this.layers.set(name, layer);
        }

        this.applyTransform();
        this.attachInput(container);
    }

    resize(size: TSize): void {
        this.stage?.size({ width: Math.max(1, size.width), height: Math.max(1, size.height) });
        this.scheduleRecache();
    }

    setTransform(transform: TViewportTransform): void {
        this.transform = transform;
        this.applyTransform();
    }

    private applyTransform(): void {
        if (!this.stage) return;
        const { position, scale } = this.transform;
        this.stage.scale({ x: scale.width, y: scale.height });
        this.stage.position({ x: -position.x * scale.width, y: -position.y * scale.height });

        // A cached layer is a bitmap baked at one zoom. Drop it while the view is moving —
        // scaling a stale bitmap is exactly the blur this would otherwise be blamed for — and
        // bake a fresh one once the author stops.
        if (this.cachedLayers.size > 0) {
            for (const name of this.cachedLayers) this.layers.get(name)?.clearCache();
            this.scheduleRecache();
        }
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.recacheTimer !== null) clearTimeout(this.recacheTimer);
        this.recacheTimer = null;
        this.detachInput();
        this.stage?.destroy();
        this.stage = null;
        this.layers.clear();
        for (const map of this.nodes.values()) map.clear();
        this.images.clear();
        this.container = null;
    }

    /* ------------------------------------------------------------ reconcile */

    upsert(layer: TLayerName, id: string, spec: TDrawSpec): void {
        const konvaLayer = this.layers.get(layer);
        if (!konvaLayer) return;

        const registry = this.nodes.get(layer)!;
        const existing = registry.get(id);

        if (existing && existing.kind === spec.kind) {
            this.applySpec(existing.node, spec);
            return;
        }

        existing?.node.destroy();
        const node = this.createNode(spec);
        if (!node) return;
        this.applySpec(node, spec);
        konvaLayer.add(node as Konva.Shape | Konva.Group);
        registry.set(id, { kind: spec.kind, node });
        // A new child lands on top; the next `setOrder` has to be able to see that as a change.
        this.appliedOrder.delete(layer);
    }

    /**
     * Reorders a layer's children to match `ids`.
     *
     * Konva's `zIndex` setter splices the parent's child array, so applying it to every node
     * would be O(n²) per frame. The declared order is therefore compared against the last one
     * applied and the whole pass is skipped when nothing moved — which is every frame except
     * the ones where an object is added, removed, or has its `z` changed.
     */
    setOrder(layer: TLayerName, ids: readonly string[]): void {
        const registry = this.nodes.get(layer);
        if (!registry) return;

        const drawn = ids.filter((id) => registry.has(id));
        const previous = this.appliedOrder.get(layer);
        if (previous && previous.length === drawn.length && previous.every((id, i) => id === drawn[i])) {
            return;
        }

        drawn.forEach((id, index) => registry.get(id)!.node.zIndex(index));
        this.appliedOrder.set(layer, drawn);
    }

    remove(layer: TLayerName, id: string): void {
        const registry = this.nodes.get(layer);
        const managed = registry?.get(id);
        if (!managed) return;
        managed.node.destroy();
        registry!.delete(id);
        this.appliedOrder.delete(layer);
    }

    clearLayer(layer: TLayerName): void {
        const registry = this.nodes.get(layer);
        if (!registry) return;
        for (const managed of registry.values()) managed.node.destroy();
        registry.clear();
        this.appliedOrder.delete(layer);
    }

    setLayerCached(layer: TLayerName, cached: boolean): void {
        if (cached) {
            this.cachedLayers.add(layer);
            this.scheduleRecache();
        } else {
            this.cachedLayers.delete(layer);
            this.layers.get(layer)?.clearCache();
        }
    }

    draw(): void {
        if (!this.stage) return;
        for (const layer of this.layers.values()) layer.batchDraw();
        if (this.cachedLayers.size > 0) this.scheduleRecache();
    }

    setCursor(cursor: string): void {
        if (this.container) this.container.style.cursor = cursor;
    }

    private scheduleRecache(): void {
        if (this.recacheTimer !== null) clearTimeout(this.recacheTimer);
        this.recacheTimer = setTimeout(() => {
            this.recacheTimer = null;
            if (this.destroyed) return;
            for (const name of this.cachedLayers) {
                const layer = this.layers.get(name);
                if (!layer) continue;
                layer.clearCache();
                // Nothing to bake on an empty layer, and Konva throws on a zero-size cache.
                if (layer.getChildren().length > 0) layer.cache();
                layer.batchDraw();
            }
        }, RECACHE_IDLE_MS);
    }

    /* ------------------------------------------------------------ node kinds */

    private createNode(spec: TDrawSpec): Konva.Node | null {
        switch (spec.kind) {
            case 'polygon':
            case 'line':
                return new Line({ listening: false });
            case 'rect':
                return new Rect({ listening: false });
            case 'circle':
                return new Circle({ listening: false });
            case 'text':
                return new Text({ listening: false });
            case 'arrow':
                return new Arrow({ points: [], listening: false });
            case 'image':
                return new KonvaImage({ image: undefined, listening: false });
            case 'group':
                return new Konva.Group({ listening: false });
            default:
                return null;
        }
    }

    private applySpec(node: Konva.Node, spec: TDrawSpec): void {
        node.opacity(spec.opacity ?? 1);

        switch (spec.kind) {
            case 'polygon': {
                const line = node as Line;
                line.points(spec.points);
                line.closed(true);
                line.fill(spec.fill);
                this.applyStroke(line, spec);
                break;
            }
            case 'line': {
                const line = node as Line;
                line.points(spec.points);
                line.closed(spec.closed ?? false);
                line.tension(spec.tension ?? 0);
                line.fill(undefined);
                this.applyStroke(line, spec);
                break;
            }
            case 'rect': {
                const rect = node as Rect;
                rect.position(spec.position);
                rect.size(spec.size);
                rect.cornerRadius(spec.cornerRadius ?? 0);
                rect.fill(spec.fill);
                this.applyStroke(rect, spec);
                break;
            }
            case 'circle': {
                const circle = node as Circle;
                circle.position(spec.position);
                circle.fill(spec.fill);
                this.applyStroke(circle, spec);
                if (spec.screenRadius) {
                    // Radius in screen pixels: counter-scale the node so the stage zoom
                    // cancels out. This is how a vertex handle stays grabbable at any zoom.
                    circle.radius(spec.radius);
                    this.counterScale(circle);
                } else {
                    circle.radius(spec.radius);
                    circle.scale({ x: 1, y: 1 });
                }
                break;
            }
            case 'text': {
                const text = node as Text;
                text.text(spec.text);
                text.fontSize(spec.fontSize);
                text.fontFamily(spec.fontFamily ?? 'sans-serif');
                text.fontStyle(spec.fontStyle ?? 'normal');
                text.fill(spec.fill ?? '#ffffff');
                text.align(spec.align ?? 'left');
                text.rotation(spec.rotation ?? 0);
                text.padding(spec.padding ?? 0);
                // `fontSize` is screen pixels by contract (§3.2 "zoom-stable sizing"), so the
                // glyphs are drawn at native size and the stage zoom is divided back out.
                this.counterScale(text);
                text.position(spec.position);
                if (spec.background) {
                    text.fill(spec.fill ?? '#ffffff');
                    text.setAttr('sceneFunc', undefined);
                }
                // Konva measures only after the text and font are set, so centring is last.
                if (spec.centered) {
                    text.offsetX(text.width() / 2);
                    text.offsetY(text.height() / 2);
                } else {
                    text.offsetX(0);
                    text.offsetY(0);
                }
                break;
            }
            case 'arrow': {
                const arrow = node as Arrow;
                arrow.points(spec.points);
                arrow.fill(spec.fill ?? spec.stroke);
                arrow.pointerLength(spec.pointerLength ?? 8);
                arrow.pointerWidth(spec.pointerWidth ?? 8);
                this.applyStroke(arrow, spec);
                break;
            }
            case 'image': {
                const image = node as KonvaImage;
                image.position(spec.position);
                image.size(spec.size);
                this.loadImage(spec.src, (element) => image.image(element));
                break;
            }
            case 'group': {
                const group = node as Konva.Group;
                group.destroyChildren();
                for (const child of spec.children) {
                    const childNode = this.createNode(child);
                    if (!childNode) continue;
                    this.applySpec(childNode, child);
                    group.add(childNode as Konva.Shape | Konva.Group);
                }
                break;
            }
        }
    }

    /**
     * Cancels the stage zoom on one node, so whatever it draws is in screen pixels. Guards
     * against a zero scale, which would be a division by zero and a node that vanishes.
     */
    private counterScale(node: Konva.Node): void {
        const { scale } = this.transform;
        node.scale({
            x: scale.width === 0 ? 1 : 1 / scale.width,
            y: scale.height === 0 ? 1 : 1 / scale.height,
        });
    }

    private applyStroke(shape: Konva.Shape, spec: TDrawSpec & { stroke?: string; strokeWidth?: number }): void {
        const styled = spec as {
            stroke?: string;
            strokeWidth?: number;
            strokeScaleEnabled?: boolean;
            dash?: number[];
            lineCap?: 'butt' | 'round' | 'square';
            lineJoin?: 'miter' | 'round' | 'bevel';
        };
        shape.stroke(styled.stroke);
        shape.strokeWidth(styled.strokeWidth ?? 1);
        // Konva's own flag: false means the width is screen pixels regardless of zoom, which is
        // what handles and guides want and what a location outline must not have.
        shape.strokeScaleEnabled(styled.strokeScaleEnabled ?? true);
        shape.dash(styled.dash);
        shape.lineCap(styled.lineCap ?? 'butt');
        shape.lineJoin(styled.lineJoin ?? 'miter');
    }

    private loadImage(src: string, apply: (image: HTMLImageElement) => void): void {
        const cached = this.images.get(src);
        if (cached) {
            if (cached.complete && cached.naturalWidth > 0) apply(cached);
            else cached.addEventListener('load', () => apply(cached), { once: true });
            return;
        }

        const element = new Image();
        this.images.set(src, element);
        element.addEventListener(
            'load',
            () => {
                if (this.destroyed) return;
                apply(element);
                // One redraw per decoded image, coalesced: a map with a dozen assets must not
                // schedule a dozen full draws in the same frame.
                if (!this.pendingImageDraw) {
                    this.pendingImageDraw = true;
                    queueMicrotask(() => {
                        this.pendingImageDraw = false;
                        this.draw();
                    });
                }
            },
            { once: true }
        );
        element.src = src;
    }

    /* --------------------------------------------------------------- input */

    onPointer(handler: (event: TPointerEvent) => void): () => void {
        this.pointerObserver.subscribe(handler);
        return () => this.pointerObserver.unsubscribe(handler);
    }

    onKey(handler: (event: TKeyEvent) => void): () => void {
        this.keyObserver.subscribe(handler);
        return () => this.keyObserver.unsubscribe(handler);
    }

    private listeners: { target: EventTarget; type: string; handler: EventListener }[] = [];

    private attachInput(container: HTMLElement): void {
        const on = (target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions) => {
            target.addEventListener(type, handler, options);
            this.listeners.push({ target, type, handler });
        };

        const pointer = (type: TPointerEvent['type']) => (raw: Event) => {
            const event = raw as PointerEvent;
            this.pointerObserver.notify(this.toPointerEvent(type, event));
        };

        on(container, 'pointerdown', pointer('down'));
        on(container, 'pointermove', pointer('move'));
        // `up` and `leave` go on the window: a drag that ends outside the canvas must still end.
        on(window, 'pointerup', pointer('up'));
        on(container, 'pointerleave', pointer('leave'));
        on(container, 'click', pointer('click'));
        on(container, 'dblclick', pointer('dblclick'));
        on(container, 'contextmenu', pointer('contextmenu'));

        on(
            container,
            'wheel',
            (raw: Event) => {
                const event = raw as WheelEvent;
                this.pointerObserver.notify({
                    ...this.toPointerEvent('wheel', event),
                    deltaY: event.deltaY,
                });
            },
            // Not passive: zoom-on-scroll has to be able to stop the page from scrolling too.
            { passive: false }
        );

        const key = (type: TKeyEvent['type']) => (raw: Event) => {
            const event = raw as KeyboardEvent;
            this.keyObserver.notify({
                type,
                key: event.key,
                code: event.code,
                shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                fromTextInput: isTextInput(event.target),
                preventDefault: () => event.preventDefault(),
            });
        };

        // On the window, because the canvas is not focusable and WSAD must work while the
        // author's cursor is over it. `fromTextInput` is what keeps typing in a form from
        // panning the map behind it.
        on(window, 'keydown', key('keydown'));
        on(window, 'keyup', key('keyup'));
    }

    private detachInput(): void {
        for (const { target, type, handler } of this.listeners) {
            target.removeEventListener(type, handler);
        }
        this.listeners = [];
    }

    private toPointerEvent(type: TPointerEvent['type'], event: MouseEvent): TPointerEvent {
        const screen = this.toScreen(event);
        return {
            type,
            screen,
            world: this.toWorld(screen),
            button: event.button,
            buttons: event.buttons,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            preventDefault: () => event.preventDefault(),
        };
    }

    private toScreen(event: MouseEvent): TPoint {
        const rect = this.container?.getBoundingClientRect();
        if (!rect) return { x: event.clientX, y: event.clientY };
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    /**
     * Screen → world. The renderer owns this rather than delegating to `Viewport` because a
     * pointer event has to carry world coordinates the moment it is created — routing it
     * through the scene first would mean tools receiving screen pixels, which design rule 1
     * exists to prevent.
     */
    private toWorld(screen: TPoint): TPoint {
        const { position, scale } = this.transform;
        return {
            x: position.x + screen.x / (scale.width || 1),
            y: position.y + screen.y / (scale.height || 1),
        };
    }
}

const isTextInput = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};
