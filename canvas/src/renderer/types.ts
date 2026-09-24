import type { TColor, TPoint, TSize } from '@story/shared';

/**
 * The renderer port (VISUALIZER_PLAN §3.3, §5 risk 5).
 *
 * Konva cannot run under Node without the native `canvas` package, which this repo declined to
 * take on. So `Scene` never imports Konva: it talks to this interface, `KonvaRenderer`
 * implements it for the browser, and `FakeRenderer` implements it for the tests. The cost is
 * one indirection; what it buys is that every tool — the part with the state machines and
 * therefore the bugs — is testable.
 *
 * The port is **declarative**. A `SceneObject` does not issue draw calls; it returns a
 * `TDrawSpec` describing what it looks like, and the renderer reconciles that against whatever
 * it drew last time. Two consequences worth stating, because they shaped everything else:
 *
 *  1. The fake renderer is trivial and *honest* — it records specs, so a test asserts on what
 *     an object claims to look like rather than on a sequence of canvas calls.
 *  2. Hit-testing cannot live in the renderer, because the fake has no hit graph. It lives in
 *     `SceneObject.hitTest`, in world units, shared by both renderers. This is a deviation from
 *     §2's passing reference to `Shape.hitFunc`, and it is the right one: §3.3's fake-renderer
 *     requirement and design rule 1 ("world units everywhere") both point here, and a geometric
 *     point-in-polygon in world space is *more* exact than a screen-space hit graph, not less.
 *     Konva still earns its place on rendering, DPR, text metrics and layer caching.
 */

/** The four layers of §3.2, bottom to top. */
export type TLayerName = 'background' | 'content' | 'overlay' | 'interaction';

export const LAYER_ORDER: readonly TLayerName[] = ['background', 'content', 'overlay', 'interaction'];

/** Fields every drawable shares. All coordinates are world units (design rule 1). */
type TDrawBase = {
    opacity?: number;
    /** Multiplied into the renderer's world→screen scale, so `1` means "one world unit". */
    listening?: boolean;
};

export type TStrokeStyle = {
    stroke?: TColor;
    strokeWidth?: number;
    /**
     * When true the stroke keeps a constant *screen* width at every zoom. Handles and guides
     * want this; a location's outline does not, or the map redraws differently at every zoom.
     */
    strokeScaleEnabled?: boolean;
    dash?: number[];
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
};

export type TFillStyle = {
    fill?: TColor;
};

export type TPolygonSpec = TDrawBase &
    TStrokeStyle &
    TFillStyle & {
        kind: 'polygon';
        /** Flat `[x, y, …]`, implicitly closed. */
        points: number[];
    };

export type TLineSpec = TDrawBase &
    TStrokeStyle & {
        kind: 'line';
        points: number[];
        closed?: boolean;
        /** Konva's spline smoothing — what makes a freehand brush stroke read as a curve. */
        tension?: number;
    };

export type TRectSpec = TDrawBase &
    TStrokeStyle &
    TFillStyle & {
        kind: 'rect';
        position: TPoint;
        size: TSize;
        cornerRadius?: number;
    };

export type TCircleSpec = TDrawBase &
    TStrokeStyle &
    TFillStyle & {
        kind: 'circle';
        position: TPoint;
        /** World units, unless `screenRadius` is set — vertex handles want a fixed pixel size. */
        radius: number;
        screenRadius?: boolean;
    };

export type TTextSpec = TDrawBase &
    TFillStyle & {
        kind: 'text';
        position: TPoint;
        text: string;
        /**
         * In *screen* pixels, not world units, and the renderer divides out the zoom. Labels
         * that scale with zoom are unreadable at both ends of the range; §3.2 calls this
         * "zoom-stable sizing" and this flag is where it happens.
         */
        fontSize: number;
        fontFamily?: string;
        fontStyle?: string;
        rotation?: number;
        align?: 'left' | 'center' | 'right';
        /** Anchor the text box on its own centre rather than its top-left. */
        centered?: boolean;
        /** Drawn behind the glyphs so a label stays legible over a dark polygon. */
        background?: TColor;
        padding?: number;
    };

export type TArrowSpec = TDrawBase &
    TStrokeStyle &
    TFillStyle & {
        kind: 'arrow';
        points: number[];
        pointerLength?: number;
        pointerWidth?: number;
    };

export type TImageSpec = TDrawBase & {
    kind: 'image';
    position: TPoint;
    size: TSize;
    /** A URL. The renderer owns loading and caching; the object just names the asset. */
    src: string;
};

export type TGroupSpec = TDrawBase & {
    kind: 'group';
    children: TDrawSpec[];
};

export type TDrawSpec =
    | TPolygonSpec
    | TLineSpec
    | TRectSpec
    | TCircleSpec
    | TTextSpec
    | TArrowSpec
    | TImageSpec
    | TGroupSpec;

/** How the renderer is told to map world coordinates onto the canvas. */
export type TViewportTransform = {
    /** World coordinate displayed at screen `(0, 0)`. */
    position: TPoint;
    /** Screen pixels per world unit, per axis — separate so zoom can be anisotropic. */
    scale: TSize;
};

/** A pointer event after the scene has normalised it. `world` is the payload tools use. */
export type TPointerEvent = {
    type: 'down' | 'move' | 'up' | 'click' | 'dblclick' | 'wheel' | 'leave' | 'contextmenu';
    /** World coordinates — the only ones a `Tool` should ever read (design rule 1). */
    world: TPoint;
    /** Screen coordinates, for the rare thing that is genuinely pixel-sized (a marquee). */
    screen: TPoint;
    button: number;
    buttons: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    /** Wheel delta, present only on `wheel`. */
    deltaY?: number;
    /** Call to stop the host page from also acting on the event. */
    preventDefault: () => void;
};

export type TKeyEvent = {
    type: 'keydown' | 'keyup';
    key: string;
    code: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    /** True when the event came from a text field, so the scene should ignore it. */
    fromTextInput: boolean;
    preventDefault: () => void;
};

/**
 * What `Scene` requires of a renderer.
 *
 * Note what is *absent*: no hit-testing, no object model, no z-ordering within a layer beyond
 * insertion order. Those are the scene's, and keeping them out of here is what makes the fake
 * a dozen lines rather than a second renderer.
 */
export interface IRenderer {
    /** Attach to a container element and size the canvas to it. */
    mount(container: HTMLElement, size: TSize): void;

    /** Canvas size in CSS pixels. The renderer handles device-pixel-ratio internally. */
    resize(size: TSize): void;

    /** Set the world→screen transform for every layer at once. */
    setTransform(transform: TViewportTransform): void;

    /** Create or update the drawable registered under `id` on `layer`. */
    upsert(layer: TLayerName, id: string, spec: TDrawSpec): void;

    /**
     * Declare the paint order of a layer, bottom to top. Ids not currently drawn are ignored.
     *
     * This is separate from `upsert` because `upsert` on an existing id only sets attributes —
     * it does not move the node. Without an explicit order call, changing an object's `z`
     * would repaint it with the right *look* in the wrong *place in the stack*, in Konva as
     * much as in the fake. Implementations are expected to no-op when the order is unchanged,
     * since this is called once per layer per frame.
     */
    setOrder(layer: TLayerName, ids: readonly string[]): void;

    /** Remove the drawable registered under `id`, if any. */
    remove(layer: TLayerName, id: string): void;

    /** Remove everything on a layer. */
    clearLayer(layer: TLayerName): void;

    /**
     * Cache a layer to an offscreen bitmap, or stop doing so. Phase 0's Konva spike could not be
     * measured headlessly, so §7's mitigation is taken up front: the brush layer, which is the
     * one with thousands of points and no interactivity, is cached.
     */
    setLayerCached(layer: TLayerName, cached: boolean): void;

    /** Flush pending changes. Batched by the renderer; calling it more often is not an error. */
    draw(): void;

    /** Set the CSS cursor on the container. */
    setCursor(cursor: string): void;

    /** Subscribe to normalised pointer input. Returns an unsubscribe function. */
    onPointer(handler: (event: TPointerEvent) => void): () => void;

    /** Subscribe to keyboard input. Returns an unsubscribe function. */
    onKey(handler: (event: TKeyEvent) => void): () => void;

    destroy(): void;
}
