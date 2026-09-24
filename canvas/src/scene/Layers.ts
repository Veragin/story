import { Observer } from '@story/shared';
import { LAYER_ORDER, type TLayerName } from '../renderer/types';
import type { SceneObject } from './SceneObject';

/**
 * The scene's object index, split by layer (VISUALIZER_PLAN §3.2).
 *
 * The four layers, bottom to top:
 *
 *  - `background` — the map image, the grid, the timeline axis. Rarely changes, never clicked.
 *  - `content`    — the domain objects: locations, passage boxes, edges, notes, strokes.
 *  - `overlay`    — vertex handles, snap guides, the marquee. Owned by tools, never persisted.
 *  - `interaction`— transient feedback that must sit above even the handles (a drag preview).
 *
 * Paint order within a layer is `z`, ties broken by insertion order, which is what makes a
 * z-less scene behave the obvious way. Hit-testing walks the exact reverse, so the thing drawn
 * last is the thing clicked first.
 *
 * The sorted array is rebuilt lazily and only when something that affects order actually
 * changed. A map with hundreds of polygons re-sorts once per structural change, not once per
 * pointer-move.
 */
export class Layers {
    private readonly byLayer = new Map<TLayerName, SceneObject[]>();
    private readonly insertionOrder = new Map<string, number>();
    private readonly sortedCache = new Map<TLayerName, SceneObject[] | null>();
    private nextInsertion = 0;

    readonly onAdded = new Observer<SceneObject>();
    readonly onRemoved = new Observer<SceneObject>();

    constructor() {
        for (const layer of LAYER_ORDER) {
            this.byLayer.set(layer, []);
            this.sortedCache.set(layer, null);
        }
    }

    add(object: SceneObject): void {
        const list = this.byLayer.get(object.layer);
        if (!list) throw new Error(`Unknown layer "${object.layer}" on object "${object.id}"`);
        if (this.insertionOrder.has(object.id)) {
            throw new Error(`Duplicate scene object id "${object.id}"`);
        }
        this.insertionOrder.set(object.id, this.nextInsertion++);
        list.push(object);
        this.sortedCache.set(object.layer, null);
        this.onAdded.notify(object);
    }

    remove(object: SceneObject): boolean {
        const list = this.byLayer.get(object.layer);
        if (!list) return false;
        const index = list.indexOf(object);
        if (index === -1) return false;
        list.splice(index, 1);
        this.insertionOrder.delete(object.id);
        this.sortedCache.set(object.layer, null);
        this.onRemoved.notify(object);
        return true;
    }

    /**
     * Moves an object between layers, keeping its identity. Called when a tool promotes a
     * half-drawn shape from `overlay` to `content`.
     */
    relayer(object: SceneObject, from: TLayerName): void {
        const list = this.byLayer.get(from);
        const index = list?.indexOf(object) ?? -1;
        if (index === -1) return;
        list!.splice(index, 1);
        this.sortedCache.set(from, null);
        this.byLayer.get(object.layer)?.push(object);
        this.sortedCache.set(object.layer, null);
    }

    /** Marks a layer's paint order stale — called when an object's `z` changes. */
    invalidateOrder(layer: TLayerName): void {
        this.sortedCache.set(layer, null);
    }

    has(object: SceneObject): boolean {
        return this.insertionOrder.has(object.id);
    }

    get(id: string): SceneObject | undefined {
        for (const layer of LAYER_ORDER) {
            const found = this.byLayer.get(layer)?.find((o) => o.id === id);
            if (found) return found;
        }
        return undefined;
    }

    /** Every object, in paint order: bottom layer first, ascending `z` within each. */
    all(): SceneObject[] {
        return LAYER_ORDER.flatMap((layer) => this.sorted(layer));
    }

    /** One layer's objects in paint order. */
    sorted(layer: TLayerName): SceneObject[] {
        const cached = this.sortedCache.get(layer);
        if (cached) return cached;

        const list = [...(this.byLayer.get(layer) ?? [])].sort((a, b) => {
            if (a.z !== b.z) return a.z - b.z;
            return (this.insertionOrder.get(a.id) ?? 0) - (this.insertionOrder.get(b.id) ?? 0);
        });
        this.sortedCache.set(layer, list);
        return list;
    }

    /**
     * Every object in hit-test order: topmost first. The exact reverse of `all()`, so what the
     * author sees on top is what a click finds.
     */
    hitOrder(): SceneObject[] {
        return this.all().reverse();
    }

    clear(): void {
        for (const layer of LAYER_ORDER) {
            for (const object of [...(this.byLayer.get(layer) ?? [])]) {
                this.remove(object);
            }
        }
        this.nextInsertion = 0;
    }

    get size(): number {
        return this.insertionOrder.size;
    }
}
