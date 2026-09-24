import type { TPoint } from '@story/shared';
import type { TPointerEvent } from '../renderer/types';
import type { Scene } from '../scene/Scene';

/**
 * Viewport navigation: wheel to zoom, drag to pan.
 *
 * This sits *below* tools rather than being one (VISUALIZER_PLAN §3.2 lists no pan tool, and
 * the engine it replaces had `Panning`/`Zooming` as always-on plugins for the same reason).
 * Moving the view is not an edit: it must work while a polygon is half-drawn, and it must never
 * be the thing `Esc` returns you from.
 *
 * Which button pans is configurable because the map and the timeline disagree: the map's left
 * button draws, so it pans on middle-drag and space-drag; the timeline has no drawing tools and
 * README asks for "drag to move the timeline", so it pans on left-drag.
 */

export type TNavigationOptions = {
    /** Mouse buttons that start a pan. Defaults to middle (1) and right (2). */
    panButtons?: number[];
    /** Also pan on a left-drag while space is held. Default true. */
    panWithSpace?: boolean;
    /** Multiplier per wheel notch. Default 1.1. */
    zoomStep?: number;
    /** Set false where the view must not zoom (a fixed-scale minimap). Default true. */
    zoomEnabled?: boolean;
    /** Set false where the view must not pan. Default true. */
    panEnabled?: boolean;
    /**
     * Restricts wheel zoom to one axis. The timeline zooms time (`x`) on a plain wheel and both
     * axes only when the author asks, so it passes `'x'`.
     */
    zoomAxis?: 'both' | 'x' | 'y';
};

export class Navigation {
    private readonly panButtons: Set<number>;
    private readonly panWithSpace: boolean;
    private readonly zoomStep: number;
    private readonly zoomAxis: 'both' | 'x' | 'y';

    private unsubscribers: (() => void)[] = [];
    private panning = false;
    private lastScreen: TPoint | null = null;
    private spaceHeld = false;

    zoomEnabled: boolean;
    panEnabled: boolean;

    constructor(
        private readonly scene: Scene,
        options: TNavigationOptions = {}
    ) {
        this.panButtons = new Set(options.panButtons ?? [1, 2]);
        this.panWithSpace = options.panWithSpace ?? true;
        this.zoomStep = options.zoomStep ?? 1.1;
        this.zoomAxis = options.zoomAxis ?? 'both';
        this.zoomEnabled = options.zoomEnabled ?? true;
        this.panEnabled = options.panEnabled ?? true;

        const onPointer = (event: TPointerEvent) => this.handlePointer(event);
        scene.onPointer.subscribe(onPointer);
        this.unsubscribers.push(() => scene.onPointer.unsubscribe(onPointer));

        const onKey = (event: { type: string; code: string; fromTextInput: boolean }) => {
            if (event.fromTextInput || !this.panWithSpace) return;
            if (event.code !== 'Space') return;
            this.spaceHeld = event.type === 'keydown';
        };
        scene.onKey.subscribe(onKey);
        this.unsubscribers.push(() => scene.onKey.unsubscribe(onKey));
    }

    /** True while a pan drag is in progress — tools check this to stay out of the way. */
    get isPanning(): boolean {
        return this.panning;
    }

    private handlePointer(event: TPointerEvent): void {
        switch (event.type) {
            case 'wheel': {
                if (!this.zoomEnabled || event.deltaY === undefined) return;
                event.preventDefault();
                const factor = event.deltaY < 0 ? this.zoomStep : 1 / this.zoomStep;
                this.scene.viewport.zoomAt(
                    event.screen,
                    this.zoomAxis === 'both'
                        ? factor
                        : this.zoomAxis === 'x'
                          ? { width: factor, height: 1 }
                          : { width: 1, height: factor }
                );
                return;
            }

            case 'down': {
                if (!this.panEnabled) return;
                const wantsPan = this.panButtons.has(event.button) || (this.spaceHeld && event.button === 0);
                if (!wantsPan) return;
                event.preventDefault();
                this.panning = true;
                this.lastScreen = event.screen;
                this.scene.setCursor('grabbing');
                return;
            }

            case 'move': {
                if (!this.panning || !this.lastScreen) return;
                this.scene.viewport.pan({
                    x: event.screen.x - this.lastScreen.x,
                    y: event.screen.y - this.lastScreen.y,
                });
                this.lastScreen = event.screen;
                return;
            }

            case 'up':
            case 'leave': {
                if (!this.panning) return;
                this.panning = false;
                this.lastScreen = null;
                this.scene.setCursor('default');
                return;
            }

            case 'contextmenu': {
                // Right-drag is a pan by default, so the menu that would otherwise interrupt it
                // is suppressed — but only when right-drag is actually bound to panning.
                if (this.panEnabled && this.panButtons.has(2)) event.preventDefault();
                return;
            }

            default:
                return;
        }
    }

    destroy(): void {
        for (const unsubscribe of this.unsubscribers) unsubscribe();
        this.unsubscribers = [];
    }
}
