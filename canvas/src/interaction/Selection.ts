import { Observer } from '@story/shared';
import type { SceneObject } from '../scene/SceneObject';

/**
 * The selected set (VISUALIZER_PLAN §3.2 `interaction/Selection.ts`).
 *
 * Kept out of `SceneObject` on purpose. An object's `selected` flag is *presentation* — it is
 * what makes the outline brighten — but selection itself is a property of the editing session:
 * two scenes over the same objects would each have their own, and "what is selected" has to be
 * observable as one event, not as N property changes the subscriber has to reassemble.
 *
 * The two are kept in sync here: `Selection` writes `selected` on the objects it holds, because
 * making every object subscribe to a selection it may not belong to would be the more expensive
 * half of the same coupling.
 */

export type TSelectionChange = {
    selected: readonly SceneObject[];
    added: readonly SceneObject[];
    removed: readonly SceneObject[];
};

/** Anything with a `selected` flag gets highlighted; anything else is still selectable. */
type TSelectable = SceneObject & { selected?: boolean };

export class Selection {
    private readonly items = new Set<SceneObject>();

    readonly onChange = new Observer<TSelectionChange>();

    get size(): number {
        return this.items.size;
    }

    get isEmpty(): boolean {
        return this.items.size === 0;
    }

    /** Insertion order, which is the order the author picked things in. */
    get all(): SceneObject[] {
        return [...this.items];
    }

    /** The only member, or `undefined` when zero or many are selected. */
    get single(): SceneObject | undefined {
        return this.items.size === 1 ? this.items.values().next().value : undefined;
    }

    has(object: SceneObject): boolean {
        return this.items.has(object);
    }

    /** Replaces the selection. The common case: a plain click. */
    set(objects: readonly SceneObject[]): void {
        const next = objects.filter((object) => object.selectable);
        const added = next.filter((object) => !this.items.has(object));
        const removed = [...this.items].filter((object) => !next.includes(object));
        if (added.length === 0 && removed.length === 0) return;

        for (const object of removed) this.mark(object, false);
        this.items.clear();
        for (const object of next) {
            this.items.add(object);
            this.mark(object, true);
        }

        this.onChange.notify({ selected: this.all, added, removed });
    }

    add(objects: readonly SceneObject[]): void {
        const added = objects.filter((object) => object.selectable && !this.items.has(object));
        if (added.length === 0) return;
        for (const object of added) {
            this.items.add(object);
            this.mark(object, true);
        }
        this.onChange.notify({ selected: this.all, added, removed: [] });
    }

    remove(objects: readonly SceneObject[]): void {
        const removed = objects.filter((object) => this.items.has(object));
        if (removed.length === 0) return;
        for (const object of removed) {
            this.items.delete(object);
            this.mark(object, false);
        }
        this.onChange.notify({ selected: this.all, added: [], removed });
    }

    /** In-or-out for each object. What shift-click does. */
    toggle(objects: readonly SceneObject[]): void {
        const added: SceneObject[] = [];
        const removed: SceneObject[] = [];

        for (const object of objects) {
            if (!object.selectable) continue;
            if (this.items.has(object)) {
                this.items.delete(object);
                this.mark(object, false);
                removed.push(object);
            } else {
                this.items.add(object);
                this.mark(object, true);
                added.push(object);
            }
        }

        if (added.length === 0 && removed.length === 0) return;
        this.onChange.notify({ selected: this.all, added, removed });
    }

    clear(): void {
        if (this.items.size === 0) return;
        const removed = this.all;
        for (const object of removed) this.mark(object, false);
        this.items.clear();
        this.onChange.notify({ selected: [], added: [], removed });
    }

    /**
     * Drops objects that are no longer in the scene.
     *
     * Necessary because `Selection` holds strong references: deleting a selected object without
     * this would keep it alive, keep it "selected", and let a subsequent Delete press try to
     * remove it a second time.
     */
    prune(isPresent: (object: SceneObject) => boolean): void {
        const gone = this.all.filter((object) => !isPresent(object));
        if (gone.length === 0) return;
        for (const object of gone) this.items.delete(object);
        this.onChange.notify({ selected: this.all, added: [], removed: gone });
    }

    private mark(object: SceneObject, selected: boolean): void {
        const selectable = object as TSelectable;
        if ('selected' in selectable) selectable.selected = selected;
    }
}
