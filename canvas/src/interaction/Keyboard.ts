import type { TKeyEvent } from '../renderer/types';
import type { Scene } from '../scene/Scene';

/**
 * Keyboard navigation and the undo/redo chord (VISUALIZER_PLAN §3.2 `interaction/Keyboard.ts`;
 * README § Visualizer, "zoom on scroll, WSAD/arrows to move").
 *
 * Pan is **held-key with a frame loop**, not one step per `keydown`. Holding a key fires
 * `keydown` at the OS repeat rate — a pause of about half a second and then a stutter — which
 * feels nothing like moving a map. Tracking which keys are down and panning once per frame is
 * what makes WSAD feel like WSAD.
 *
 * Every handler bails on `fromTextInput`: the author typing "was" into a passage title must not
 * pan the canvas behind the modal.
 */

export type TKeyboardOptions = {
    /** World units per second at 1:1 zoom. Scaled by the zoom so the *screen* speed is constant. */
    panSpeed?: number;
    /** Multiplier per `+`/`-` press. */
    zoomStep?: number;
    /** Held shift multiplies the pan speed by this. */
    fastMultiplier?: number;
    onUndo?: () => void;
    onRedo?: () => void;
};

const PAN_KEYS: Record<string, { x: number; y: number }> = {
    KeyW: { x: 0, y: -1 },
    KeyS: { x: 0, y: 1 },
    KeyA: { x: -1, y: 0 },
    KeyD: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
};

export class Keyboard {
    private readonly panSpeed: number;
    private readonly zoomStep: number;
    private readonly fastMultiplier: number;
    private readonly onUndo?: () => void;
    private readonly onRedo?: () => void;

    private readonly held = new Set<string>();
    private shiftHeld = false;
    private frameHandle: number | null = null;
    private lastFrameTime = 0;
    private unsubscribe: (() => void) | null = null;

    constructor(
        private readonly scene: Scene,
        options: TKeyboardOptions = {}
    ) {
        this.panSpeed = options.panSpeed ?? 600;
        this.zoomStep = options.zoomStep ?? 1.15;
        this.fastMultiplier = options.fastMultiplier ?? 3;
        this.onUndo = options.onUndo;
        this.onRedo = options.onRedo;

        const handler = (event: TKeyEvent) => this.handle(event);
        scene.onKey.subscribe(handler);
        this.unsubscribe = () => scene.onKey.unsubscribe(handler);
    }

    private handle(event: TKeyEvent): void {
        if (event.fromTextInput) return;
        this.shiftHeld = event.shiftKey;

        if (event.type === 'keyup') {
            this.held.delete(event.code);
            if (this.held.size === 0) this.stopLoop();
            return;
        }

        // Ctrl/Cmd+Z, Ctrl+Shift+Z and Ctrl+Y — before the pan keys, since Ctrl+A/Ctrl+S are
        // chords the browser and the app own, not pan commands.
        if (event.ctrlKey || event.metaKey) {
            const key = event.key.toLowerCase();
            if (key === 'z' && !event.shiftKey) {
                event.preventDefault();
                this.onUndo?.();
            } else if ((key === 'z' && event.shiftKey) || key === 'y') {
                event.preventDefault();
                this.onRedo?.();
            }
            return;
        }

        if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            this.scene.viewport.zoomAtCenter(this.zoomStep);
            return;
        }
        if (event.key === '-' || event.key === '_') {
            event.preventDefault();
            this.scene.viewport.zoomAtCenter(1 / this.zoomStep);
            return;
        }

        if (PAN_KEYS[event.code]) {
            event.preventDefault();
            this.held.add(event.code);
            this.startLoop();
        }
    }

    private startLoop(): void {
        if (this.frameHandle !== null || typeof requestAnimationFrame !== 'function') return;
        this.lastFrameTime = performance.now();
        this.frameHandle = requestAnimationFrame(this.tick);
    }

    private stopLoop(): void {
        if (this.frameHandle === null) return;
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frameHandle);
        this.frameHandle = null;
    }

    private tick = (now: number): void => {
        this.frameHandle = null;
        if (this.held.size === 0) return;

        // Delta-time rather than a per-frame constant, so panning is the same speed on a 60 Hz
        // and a 144 Hz display. Clamped so a backgrounded tab does not resume with one huge jump.
        const deltaSeconds = Math.min(0.1, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;

        let dx = 0;
        let dy = 0;
        for (const code of this.held) {
            const direction = PAN_KEYS[code];
            if (!direction) continue;
            dx += direction.x;
            dy += direction.y;
        }

        if (dx !== 0 || dy !== 0) {
            const speed = this.panSpeed * deltaSeconds * (this.shiftHeld ? this.fastMultiplier : 1);
            // Multiplied by pixel size so the pan is a constant number of *screen* pixels per
            // second however far the author has zoomed out.
            const pixelSize = this.scene.viewport.pixelSize;
            this.scene.viewport.panWorld({ x: dx * speed * pixelSize.width, y: dy * speed * pixelSize.height });
        }

        this.frameHandle = requestAnimationFrame(this.tick);
    };

    destroy(): void {
        this.stopLoop();
        this.held.clear();
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
}
