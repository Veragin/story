import { Observer, type TBBox, type TPoint } from '@story/shared';
import { isPointInBBox } from '../geometry/polygon';
import type { TDrawSpec, TLayerName } from '../renderer/types';

/**
 * Base class for everything a `Scene` draws (VISUALIZER_PLAN §3.2).
 *
 * Three of the package's five design rules land on this file:
 *
 *  - **Rule 2, no story types.** An object has an `id` and an arbitrary `meta` bag. It does not
 *    know what a `TLocationId` is; mapping one onto the other is the Visualizer's job. That is
 *    what lets `canvas/` import `@story/shared` and nothing else internal.
 *  - **Rule 3, observable not React.** Mutating an object notifies `onChange`; the scene
 *    subscribes and schedules a redraw. There is no render loop in React and no reconciler in
 *    the drag path.
 *  - **Rule 5, serialisable.** `toJSON`/`fromJSON` on every subclass, because §4 persists these
 *    as TypeScript literals and the server writes that same shape.
 *
 * Subclasses implement three things: what it looks like (`toSpec`), where it is (`bounds`), and
 * whether a point is on it (`hitTest`). Hit-testing is the scene's rather than the renderer's —
 * see the note in `renderer/types.ts` for why.
 */

export type TSceneObjectMeta = Record<string, unknown>;

export type TSceneObjectOptions = {
    id: string;
    layer?: TLayerName;
    z?: number;
    visible?: boolean;
    selectable?: boolean;
    draggable?: boolean;
    meta?: TSceneObjectMeta;
};

export type TSceneObjectJSON = {
    type: string;
    id: string;
    layer: TLayerName;
    z: number;
    visible: boolean;
    selectable: boolean;
    draggable: boolean;
    meta: TSceneObjectMeta;
};

export type TObjectChange = {
    object: SceneObject;
    /** Which property changed, or `'*'` for a bulk update. Redraw scheduling ignores it; the
     *  Visualizer's stores use it to decide whether a change is worth persisting. */
    property: string;
};

export abstract class SceneObject {
    readonly id: string;

    /** Every subclass names itself, so `fromJSON` can dispatch and tests can assert cheaply. */
    abstract readonly type: string;

    readonly onChange = new Observer<TObjectChange>();

    private _layer: TLayerName;
    private _z: number;
    private _visible: boolean;
    private _selectable: boolean;
    private _draggable: boolean;
    private _meta: TSceneObjectMeta;

    /**
     * Set while a tool is mutating the object in a tight loop (a drag). The scene still
     * redraws, but history coalesces the whole gesture into one undo entry instead of one per
     * pointer-move — design rule 4 says every mutation goes through history, not that every
     * pointer event is an undo step.
     */
    private _transient = false;

    constructor(options: TSceneObjectOptions) {
        this.id = options.id;
        this._layer = options.layer ?? 'content';
        this._z = options.z ?? 0;
        this._visible = options.visible ?? true;
        this._selectable = options.selectable ?? true;
        this._draggable = options.draggable ?? true;
        this._meta = options.meta ?? {};
    }

    /* --------------------------------------------------------- abstract API */

    /** What this object looks like, in world units. Called on every redraw. */
    abstract toSpec(): TDrawSpec;

    /** World-space axis-aligned bounds. Used for culling, marquee selection and `fit`. */
    abstract get bounds(): TBBox;

    /**
     * Is `world` on this object? `tolerance` is in world units and is how a click near a
     * one-pixel line still lands — the scene derives it from the current zoom so the slop is a
     * constant number of *pixels* however far the author has zoomed out.
     *
     * The default is the bounding box, which is right for rectangular things and is why
     * `PolygonObject` overrides it.
     */
    hitTest(world: TPoint, tolerance = 0): boolean {
        if (!this._visible) return false;
        const box = this.bounds;
        return isPointInBBox(world, {
            min: { x: box.min.x - tolerance, y: box.min.y - tolerance },
            max: { x: box.max.x + tolerance, y: box.max.y + tolerance },
        });
    }

    /** Moves the object by a world delta. Subclasses that own points override this. */
    abstract translate(delta: TPoint): void;

    /* --------------------------------------------------------- common state */

    get layer(): TLayerName {
        return this._layer;
    }
    set layer(value: TLayerName) {
        if (value === this._layer) return;
        this._layer = value;
        this.notify('layer');
    }

    /** Paint order within a layer. Higher draws later, and is hit-tested first. */
    get z(): number {
        return this._z;
    }
    set z(value: number) {
        if (value === this._z) return;
        this._z = value;
        this.notify('z');
    }

    get visible(): boolean {
        return this._visible;
    }
    set visible(value: boolean) {
        if (value === this._visible) return;
        this._visible = value;
        this.notify('visible');
    }

    get selectable(): boolean {
        return this._selectable;
    }
    set selectable(value: boolean) {
        if (value === this._selectable) return;
        this._selectable = value;
        this.notify('selectable');
    }

    get draggable(): boolean {
        return this._draggable;
    }
    set draggable(value: boolean) {
        if (value === this._draggable) return;
        this._draggable = value;
        this.notify('draggable');
    }

    get meta(): TSceneObjectMeta {
        return this._meta;
    }
    set meta(value: TSceneObjectMeta) {
        this._meta = value;
        this.notify('meta');
    }

    /** Reads a single `meta` key with a cast. The Visualizer's bridge to its own ids. */
    getMeta<T>(key: string): T | undefined {
        return this._meta[key] as T | undefined;
    }

    setMeta(key: string, value: unknown): void {
        this._meta = { ...this._meta, [key]: value };
        this.notify('meta');
    }

    get transient(): boolean {
        return this._transient;
    }
    set transient(value: boolean) {
        this._transient = value;
    }

    /** Runs `fn` with `transient` set, so the whole gesture is one history entry. */
    duringGesture(fn: () => void): void {
        const previous = this._transient;
        this._transient = true;
        try {
            fn();
        } finally {
            this._transient = previous;
        }
    }

    protected notify(property: string): void {
        this.onChange.notify({ object: this, property });
    }

    /* ------------------------------------------------------- serialisation */

    toJSON(): TSceneObjectJSON {
        return {
            type: this.type,
            id: this.id,
            layer: this._layer,
            z: this._z,
            visible: this._visible,
            selectable: this._selectable,
            draggable: this._draggable,
            meta: this._meta,
        };
    }

    /** Applies the base half of a `toJSON` payload. Subclasses call this from their own. */
    protected applyBaseJSON(json: Partial<TSceneObjectJSON>): void {
        if (json.layer !== undefined) this._layer = json.layer;
        if (json.z !== undefined) this._z = json.z;
        if (json.visible !== undefined) this._visible = json.visible;
        if (json.selectable !== undefined) this._selectable = json.selectable;
        if (json.draggable !== undefined) this._draggable = json.draggable;
        if (json.meta !== undefined) this._meta = json.meta;
    }
}
