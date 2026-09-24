import { Observer } from '@story/shared';
import type { History } from '../history/History';
import type { Navigation } from '../interaction/Navigation';
import type { Selection } from '../interaction/Selection';
import { Snapping } from '../interaction/Snapping';
import type { TKeyEvent, TPointerEvent } from '../renderer/types';
import type { Scene } from '../scene/Scene';
import type { ITool, TToolContext } from './Tool';

/**
 * Routes input to exactly one active tool (VISUALIZER_PLAN §3.2 `tools/ToolManager.ts`).
 *
 * Three rules it enforces, all of them from §3.2's one-line spec, and each one a behaviour an
 * editor is unusable without:
 *
 *  1. **Exactly one active tool.** Switching cancels the outgoing one, so a half-drawn polygon
 *     cannot survive into the brush.
 *  2. **The cursor follows the tool.** Set on activation and restored on cancel, so the cursor
 *     is never left as a crosshair after the author pressed `Esc`.
 *  3. **`Esc` always returns to select.** Pressed once it cancels the gesture in progress;
 *     pressed with nothing in progress it switches back to the select tool. That two-step is
 *     the behaviour every drawing application has, and getting it wrong means the author cannot
 *     escape a tool without reaching for the toolbar.
 *
 * It also defers to `Navigation`: while a pan drag is in progress, tools see nothing. Moving
 * the view is not an edit and must not start one.
 */

export type TToolChange = {
    tool: ITool;
    previous: ITool | null;
};

export type TToolManagerOptions = {
    scene: Scene;
    selection: Selection;
    history: History;
    snapping?: Snapping;
    /** When given, tools are suppressed while a pan is in progress. */
    navigation?: Navigation;
    /** Name of the tool `Esc` returns to. Defaults to `'select'`. */
    defaultToolName?: string;
};

export class ToolManager {
    private readonly tools = new Map<string, ITool>();
    private readonly context: TToolContext;
    private readonly navigation?: Navigation;
    private readonly defaultToolName: string;
    private active: ITool | null = null;
    private unsubscribers: (() => void)[] = [];

    readonly onToolChanged = new Observer<TToolChange>();

    constructor(options: TToolManagerOptions) {
        this.navigation = options.navigation;
        this.defaultToolName = options.defaultToolName ?? 'select';
        this.context = {
            scene: options.scene,
            selection: options.selection,
            history: options.history,
            snapping: options.snapping ?? new Snapping(),
        };

        const onPointer = (event: TPointerEvent) => this.handlePointer(event);
        options.scene.onPointer.subscribe(onPointer);
        this.unsubscribers.push(() => options.scene.onPointer.unsubscribe(onPointer));

        const onKey = (event: TKeyEvent) => this.handleKey(event);
        options.scene.onKey.subscribe(onKey);
        this.unsubscribers.push(() => options.scene.onKey.unsubscribe(onKey));
    }

    /** Registers a tool. The first one registered becomes active. */
    register(tool: ITool): this {
        this.tools.set(tool.name, tool);
        if (!this.active) this.activate(tool.name);
        return this;
    }

    registerAll(tools: readonly ITool[]): this {
        for (const tool of tools) this.register(tool);
        return this;
    }

    get activeTool(): ITool | null {
        return this.active;
    }

    get activeToolName(): string | null {
        return this.active?.name ?? null;
    }

    has(name: string): boolean {
        return this.tools.has(name);
    }

    get(name: string): ITool | undefined {
        return this.tools.get(name);
    }

    /** Switches tools. Cancelling the outgoing one is what keeps rule 1 true. */
    activate(name: string): boolean {
        const tool = this.tools.get(name);
        if (!tool) return false;
        if (tool === this.active) return true;

        const previous = this.active;
        previous?.deactivate();

        this.active = tool;
        tool.activate(this.context);
        this.context.scene.setCursor(tool.cursor ?? 'default');
        this.onToolChanged.notify({ tool, previous });
        return true;
    }

    /** `Esc`'s destination, and where a completed one-shot tool returns to. */
    activateDefault(): void {
        this.activate(this.defaultToolName);
    }

    private handlePointer(event: TPointerEvent): void {
        // Navigation wins: a pan must not also draw.
        if (this.navigation?.isPanning) return;
        const tool = this.active;
        if (!tool) return;

        switch (event.type) {
            case 'down':
                // Only the primary button reaches a tool. The others are Navigation's.
                if (event.button !== 0) return;
                tool.onPointerDown?.(event);
                return;
            case 'move':
                tool.onPointerMove?.(event);
                return;
            case 'up':
                if (event.button !== 0) return;
                tool.onPointerUp?.(event);
                return;
            case 'click':
                if (event.button !== 0) return;
                tool.onClick?.(event);
                return;
            case 'dblclick':
                tool.onDoubleClick?.(event);
                return;
            default:
                return;
        }
    }

    private handleKey(event: TKeyEvent): void {
        if (event.type !== 'keydown' || event.fromTextInput) return;

        const tool = this.active;
        if (tool?.onKeyDown?.(event)) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            // Two-step: cancel what is in progress; only then fall back to select. The tool's
            // own `onKeyDown` returning true above is how it says "I consumed this Escape".
            if (tool) {
                tool.cancel?.();
                this.context.scene.setCursor(tool.cursor ?? 'default');
            }
            if (tool?.name !== this.defaultToolName) this.activateDefault();
        }
    }

    destroy(): void {
        this.active?.deactivate();
        this.active = null;
        for (const unsubscribe of this.unsubscribers) unsubscribe();
        this.unsubscribers = [];
        this.tools.clear();
    }
}
