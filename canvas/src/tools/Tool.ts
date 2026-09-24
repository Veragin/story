import type { History } from '../history/History';
import type { Selection } from '../interaction/Selection';
import type { Snapping } from '../interaction/Snapping';
import type { TKeyEvent, TPointerEvent } from '../renderer/types';
import type { Scene } from '../scene/Scene';

/**
 * The tool interface (VISUALIZER_PLAN §3.2 `tools/Tool.ts`).
 *
 * A tool is a **state machine over normalised pointer events**, and every coordinate it sees is
 * world units (design rule 1) — the renderer converted them before the event was ever emitted.
 * A tool that reads `event.screen` is doing something screen-shaped on purpose (a marquee's
 * minimum drag distance) and should say so.
 *
 * Handlers return `true` to mean **handled** — do not let anything else act on this event. The
 * `ToolManager` uses that to keep, say, a half-drawn polygon's `Esc` from also clearing the
 * selection. Returning nothing means "not mine".
 */

/** Everything a tool is given. Passed on `activate`, not per event, so handlers stay small. */
export type TToolContext = {
    scene: Scene;
    selection: Selection;
    history: History;
    snapping: Snapping;
};

export interface ITool {
    /** Stable name — what `ToolManager.activate` takes and what the UI's buttons key off. */
    readonly name: string;

    /** CSS cursor while this tool is active. */
    readonly cursor?: string;

    activate(context: TToolContext): void;
    deactivate(): void;

    onPointerDown?(event: TPointerEvent): boolean | void;
    onPointerMove?(event: TPointerEvent): boolean | void;
    onPointerUp?(event: TPointerEvent): boolean | void;
    onClick?(event: TPointerEvent): boolean | void;
    onDoubleClick?(event: TPointerEvent): boolean | void;
    onKeyDown?(event: TKeyEvent): boolean | void;

    /**
     * Abandon whatever is in progress and return to a clean state, without leaving anything
     * half-built in the scene. `Esc` calls this; so does switching tools mid-gesture.
     */
    cancel?(): void;
}

/**
 * Base class with the context plumbing and the overlay bookkeeping every tool repeats.
 *
 * The overlay part matters: tools put transient things (vertex handles, a rubber-band preview,
 * the marquee) on the `overlay` layer, and every one of them has to disappear on cancel, on
 * deactivate, and on completion. Tracking them in one place is what stops a cancelled polygon
 * from leaving its handles behind — which is the bug this class exists to make impossible.
 */
export abstract class BaseTool implements ITool {
    abstract readonly name: string;
    readonly cursor: string = 'default';

    protected context!: TToolContext;
    private readonly overlayIds = new Set<string>();

    activate(context: TToolContext): void {
        this.context = context;
        this.onActivate();
    }

    deactivate(): void {
        this.cancel();
        this.onDeactivate();
    }

    cancel(): void {
        this.onCancel();
        this.clearOverlay();
    }

    protected onActivate(): void {
        /* optional */
    }

    protected onDeactivate(): void {
        /* optional */
    }

    protected onCancel(): void {
        /* optional */
    }

    protected get scene(): Scene {
        return this.context.scene;
    }

    protected get selection(): Selection {
        return this.context.selection;
    }

    protected get history(): History {
        return this.context.history;
    }

    protected get snapping(): Snapping {
        return this.context.snapping;
    }

    /** Adds a transient object and remembers to remove it. */
    protected addOverlay<T extends { id: string }>(object: T): T {
        this.overlayIds.add(object.id);
        this.scene.add(object as never);
        return object;
    }

    /** Removes one transient object. */
    protected removeOverlay(id: string): void {
        const object = this.scene.get(id);
        if (object) this.scene.remove(object);
        this.overlayIds.delete(id);
    }

    /** Removes every transient object this tool created. */
    protected clearOverlay(): void {
        for (const id of [...this.overlayIds]) this.removeOverlay(id);
        this.overlayIds.clear();
    }

    /** Current click slop in world units. */
    protected get tolerance(): number {
        return this.scene.worldTolerance;
    }
}
