import { Observer, type TPoint } from '@story/shared';
import { bboxFromCorners } from '../geometry/polygon';
import { SnapshotCommand } from '../history/History';
import type { TPointerEvent } from '../renderer/types';
import type { SceneObject } from '../scene/SceneObject';
import { MarqueeObject } from './MarqueeObject';
import { BaseTool } from './Tool';

/**
 * Click, shift-click, marquee, drag-move, double-click to open
 * (VISUALIZER_PLAN §3.2 `tools/SelectTool.ts`).
 *
 * ## The click/drag ambiguity
 *
 * A pointer-down on an object could begin a drag or end as a click, and which one it was is not
 * known until the pointer moves — or does not. So a down on an object *arms* a drag rather than
 * starting one, and the drag only begins once the pointer has travelled past a small threshold
 * in **screen** pixels. Without the threshold, every click moves the object by a pixel or two,
 * and the author's map drifts as they select things.
 *
 * The threshold is in screen pixels rather than world units on purpose: it is a statement about
 * the author's hand, not about the map.
 *
 * ## Selection semantics
 *
 * Selection is applied on pointer-*down* for an unselected object — because the author expects
 * the thing they grabbed to be the thing that moves — but on pointer-*up* when they clicked an
 * already-selected object, so that dragging a multi-selection does not collapse it to one.
 */

const DRAG_THRESHOLD_PX = 3;

export type TSelectToolOptions = {
    /**
     * Restricts what this tool will select. The map passes a filter that excludes the
     * background image; the chapter view excludes edges.
     */
    filter?: (object: SceneObject) => boolean;
    /** Marquee mode. `'contain'` (default) takes only what lies wholly inside. */
    marqueeMode?: 'contain' | 'intersect';
    /** Label for the undo entry a drag produces. */
    moveLabel?: string;
};

/** Emitted on double-click — the map's "open the location view", the graph's "open passage". */
export type TOpenRequest = {
    object: SceneObject;
    event: TPointerEvent;
};

type TDragState = {
    /** Where the pointer went down, in world units. */
    originWorld: TPoint;
    originScreen: TPoint;
    /** Objects being moved, with where each started, so the whole move is one undo entry. */
    subjects: { object: SceneObject; start: TPoint }[];
    started: boolean;
    /** True when the down landed on an already-selected object; see the class comment. */
    wasSelected: boolean;
    object: SceneObject;
};

export class SelectTool extends BaseTool {
    readonly name = 'select';
    readonly cursor = 'default';

    /** Fires on double-click over an object. The Visualizer opens its forms from this. */
    readonly onOpen = new Observer<TOpenRequest>();

    private readonly filter?: (object: SceneObject) => boolean;
    private readonly marqueeMode: 'contain' | 'intersect';
    private readonly moveLabel: string;

    private drag: TDragState | null = null;
    private marquee: { origin: TPoint; object: MarqueeObject } | null = null;
    private hovered: SceneObject | null = null;

    constructor(options: TSelectToolOptions = {}) {
        super();
        this.filter = options.filter;
        this.marqueeMode = options.marqueeMode ?? 'contain';
        this.moveLabel = options.moveLabel ?? 'Move';
    }

    protected onCancel(): void {
        // Put anything mid-drag back where it started: a cancelled drag must not leave the
        // object half-moved with no undo entry to reverse it.
        if (this.drag?.started) {
            for (const subject of this.drag.subjects) {
                moveTo(subject.object, subject.start);
                subject.object.transient = false;
            }
        }
        this.drag = null;
        this.marquee = null;
        this.setHovered(null);
    }

    onPointerDown(event: TPointerEvent): boolean | void {
        const hit = this.scene.hitTest(event.world, (object) => this.canSelect(object));

        if (!hit) {
            // Empty space: start a marquee. Shift keeps the existing selection so the author
            // can add a second group to the first.
            if (!event.shiftKey) this.selection.clear();
            this.marquee = {
                origin: event.world,
                object: this.addOverlay(new MarqueeObject({ id: `marquee-${this.name}` }, event.world)),
            };
            return true;
        }

        const wasSelected = this.selection.has(hit);

        if (event.shiftKey) {
            this.selection.toggle([hit]);
        } else if (!wasSelected) {
            this.selection.set([hit]);
        }

        // Arm a drag over everything selected and draggable, snapshotting where each started.
        const subjects = this.selection.all
            .filter((object) => object.draggable)
            .map((object) => ({ object, start: positionOf(object) }));

        if (subjects.length > 0) {
            this.drag = {
                originWorld: event.world,
                originScreen: event.screen,
                subjects,
                started: false,
                wasSelected,
                object: hit,
            };
        }

        return true;
    }

    onPointerMove(event: TPointerEvent): boolean | void {
        if (this.marquee) {
            this.marquee.object.setCorners(this.marquee.origin, event.world);
            return true;
        }

        if (this.drag) {
            if (!this.drag.started) {
                const travelled = Math.hypot(
                    event.screen.x - this.drag.originScreen.x,
                    event.screen.y - this.drag.originScreen.y
                );
                if (travelled < DRAG_THRESHOLD_PX) return true;
                this.drag.started = true;
                // Mark the gesture so history coalesces it into one entry.
                for (const subject of this.drag.subjects) subject.object.transient = true;
                this.scene.setCursor('grabbing');
            }

            const raw = {
                x: event.world.x - this.drag.originWorld.x,
                y: event.world.y - this.drag.originWorld.y,
            };

            // Snapping applies to the *grabbed* object's new position; the rest of the
            // selection keeps its relative offset, so a group does not collapse onto the grid.
            const primary = this.drag.subjects.find((subject) => subject.object === this.drag?.object);
            let delta = raw;
            if (primary && !event.altKey) {
                const target = { x: primary.start.x + raw.x, y: primary.start.y + raw.y };
                const snapped = this.snapping.snapToGrid(target);
                delta = { x: snapped.x - primary.start.x, y: snapped.y - primary.start.y };
            }

            for (const subject of this.drag.subjects) {
                moveTo(subject.object, { x: subject.start.x + delta.x, y: subject.start.y + delta.y });
            }
            return true;
        }

        // Not dragging: hover feedback.
        const hit = this.scene.hitTest(event.world, (object) => this.canSelect(object));
        this.setHovered(hit ?? null);
        this.scene.setCursor(hit ? 'pointer' : this.cursor);
        return;
    }

    onPointerUp(event: TPointerEvent): boolean | void {
        if (this.marquee) {
            const box = bboxFromCorners(this.marquee.origin, event.world);
            const found = this.scene.hitTestBox(box, this.marqueeMode).filter((object) => this.canSelect(object));
            if (event.shiftKey) this.selection.add(found);
            else this.selection.set(found);

            this.marquee = null;
            this.clearOverlay();
            return true;
        }

        if (!this.drag) return;

        if (this.drag.started) {
            // Record one entry spanning the whole gesture. `record` rather than `execute`: the
            // objects are already where the author dropped them.
            const subjects = this.drag.subjects;
            const before = subjects.map((subject) => subject.start);
            const after = subjects.map((subject) => positionOf(subject.object));

            for (const subject of subjects) subject.object.transient = false;

            this.history.record(
                new SnapshotCommand<TPoint[]>(
                    subjects.length === 1 ? this.moveLabel : `${this.moveLabel} ${subjects.length} objects`,
                    `move:${subjects.map((subject) => subject.object.id).join(',')}`,
                    before,
                    after,
                    (positions) => {
                        positions.forEach((position, i) => moveTo(subjects[i].object, position));
                    }
                )
            );
            this.scene.setCursor(this.cursor);
        } else if (this.drag.wasSelected && !event.shiftKey) {
            // A click (not a drag) on something already selected collapses the selection to it.
            this.selection.set([this.drag.object]);
        }

        this.drag = null;
        return true;
    }

    onDoubleClick(event: TPointerEvent): boolean | void {
        const hit = this.scene.hitTest(event.world, (object) => this.canSelect(object));
        if (!hit) return;
        this.selection.set([hit]);
        this.onOpen.notify({ object: hit, event });
        return true;
    }

    onKeyDown(event: { key: string; ctrlKey: boolean; metaKey: boolean; preventDefault: () => void }): boolean | void {
        if (event.key === 'Delete' || event.key === 'Backspace') {
            if (this.selection.isEmpty) return;
            event.preventDefault();
            this.deleteSelection();
            return true;
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            this.selection.set(this.scene.all().filter((object) => this.canSelect(object)));
            return true;
        }

        return;
    }

    /** Removes the selection as one undo entry. Public so a toolbar button can call it. */
    deleteSelection(): void {
        const doomed = this.selection.all;
        if (doomed.length === 0) return;

        this.history.transaction(doomed.length === 1 ? 'Delete' : `Delete ${doomed.length} objects`, () => {
            for (const object of doomed) {
                this.history.execute({
                    label: 'Delete',
                    execute: () => this.scene.remove(object),
                    // Re-adding restores the same instance, so anything still holding a
                    // reference to it — an edge's endpoint — keeps working after undo.
                    undo: () => this.scene.add(object),
                });
            }
        });

        this.selection.clear();
    }

    private canSelect(object: SceneObject): boolean {
        if (!object.selectable) return false;
        // Overlay and interaction layers are tool furniture, never a selection target.
        if (object.layer === 'overlay' || object.layer === 'interaction') return false;
        return this.filter ? this.filter(object) : true;
    }

    private setHovered(object: SceneObject | null): void {
        if (this.hovered === object) return;
        setHover(this.hovered, false);
        this.hovered = object;
        setHover(object, true);
    }
}

/** Reads an object's position however it spells it — polygons have points, not a position. */
const positionOf = (object: SceneObject): TPoint => {
    const positioned = object as { position?: TPoint };
    if (positioned.position) return { ...positioned.position };
    // For a polygon or a stroke, the bounding-box corner is a stable, translatable origin.
    return { ...object.bounds.min };
};

/** Moves an object to an absolute position, expressed as a translate so polygons work too. */
const moveTo = (object: SceneObject, position: TPoint): void => {
    const current = positionOf(object);
    const delta = { x: position.x - current.x, y: position.y - current.y };
    if (delta.x === 0 && delta.y === 0) return;
    object.translate(delta);
};

/**
 * Sets the hover flag on objects that have one. `BoxObject` does; `PolygonObject` deliberately
 * does not — a map full of locations that brighten under the cursor is noise, and the map tab
 * shows hover through the label instead.
 */
const setHover = (object: SceneObject | null, hovered: boolean): void => {
    if (!object) return;
    const hoverable = object as { hovered?: boolean };
    if ('hovered' in hoverable) hoverable.hovered = hovered;
};
