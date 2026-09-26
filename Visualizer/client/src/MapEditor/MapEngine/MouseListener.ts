import type { Camera, TPoint } from '../../canvas';
import type { MapStore } from '../MapStore';
import { computeTileIndex, isInsideMap, mapWorldBounds, minimapSize } from './utils';

type THold = 'paint' | 'select' | 'minimap' | 'pan';

/**
 * Pointer input of the tiles canvas. Everything is attached to the canvas itself, plus
 * `window` move/up listeners only while a button is held (the old version put keyboard, mouse
 * move, wheel and context-menu listeners on `document`, so they fired on every page).
 *
 * Only active while `mapStore.interactive` (the page's `tiles` mode); otherwise the Locations
 * scene above it owns the input. Keyboard panning is the scene's job in every mode, so both
 * layers move with one camera and there is a single WASD handler.
 *
 *  - left button: paint the brush (paint tool) or select the tile (select tool); on the minimap
 *    it moves the view;
 *  - right / middle drag: pan;
 *  - wheel: zoom at the cursor; Shift + wheel: brush size.
 */
export class MouseListener {
    private hold: THold | null = null;
    private last: TPoint | null = null;
    private readonly cleanups: (() => void)[] = [];

    constructor(
        private readonly mapStore: MapStore,
        private readonly canvas: HTMLCanvasElement,
        private readonly camera: Camera
    ) {
        this.listen(canvas, 'pointerdown', this.onPointerDown);
        this.listen(canvas, 'pointermove', this.onCanvasPointerMove);
        this.listen(canvas, 'pointerleave', this.onPointerLeave);
        this.listen(canvas, 'contextmenu', this.onContextMenu);
        this.listen(canvas, 'wheel', this.onWheel, { passive: false });
        // keyboard panning moves the camera under a still pointer: keep hover and painting in step
        this.cleanups.push(camera.subscribe(this.onCameraMove));
    }

    destroy = () => {
        this.endHold();
        for (const c of this.cleanups.splice(0)) c();
    };

    private listen(target: EventTarget, type: string, handler: (e: never) => void, options?: AddEventListenerOptions) {
        const fn = handler as unknown as EventListener;
        target.addEventListener(type, fn, options);
        this.cleanups.push(() => target.removeEventListener(type, fn, options));
    }

    private get active() {
        return this.mapStore.interactive && this.mapStore.data !== null;
    }

    private toScreen(e: MouseEvent): TPoint {
        const r = this.canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    private tileAt(screen: TPoint) {
        const map = this.mapStore.data;
        if (!map) return null;
        const world = this.camera.screenToWorld(screen);
        const tile = computeTileIndex(world.x, world.y);
        return isInsideMap(map, tile) ? tile : null;
    }

    private isOnMinimap(screen: TPoint) {
        const map = this.mapStore.data;
        if (!map || !this.mapStore.showMinimap) return false;
        const size = this.mapStore.draw?.size ?? { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
        const mini = minimapSize(size, map);
        return screen.x < mini.width && screen.y > size.height - mini.height;
    }

    /** Centres the view on the map point under a minimap position. */
    private moveByMinimap(screen: TPoint) {
        const map = this.mapStore.data;
        if (!map) return;
        const size = this.mapStore.draw?.size ?? { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
        const mini = minimapSize(size, map);
        const bounds = mapWorldBounds(map);
        const fx = Math.min(1, Math.max(0, screen.x / mini.width));
        const fy = Math.min(1, Math.max(0, (screen.y - (size.height - mini.height)) / mini.height));
        this.camera.centerOn({ x: bounds.x + fx * bounds.width, y: bounds.y + fy * bounds.height }, size);
    }

    private onPointerDown = (e: PointerEvent) => {
        if (!this.active || this.hold) return;
        const screen = this.toScreen(e);
        this.last = screen;
        if (e.button === 1 || e.button === 2) {
            this.startHold('pan');
        } else if (e.button === 0) {
            if (this.isOnMinimap(screen)) {
                this.startHold('minimap');
                this.moveByMinimap(screen);
            } else if (this.mapStore.tool === 'paint') {
                this.startHold('paint');
                const tile = this.tileAt(screen);
                if (tile) this.mapStore.paint(tile);
            } else {
                this.startHold('select');
            }
        } else {
            return;
        }
        e.preventDefault();
    };

    private startHold(hold: THold) {
        this.hold = hold;
        window.addEventListener('pointermove', this.onWindowPointerMove);
        window.addEventListener('pointerup', this.onWindowPointerUp);
        window.addEventListener('pointercancel', this.onWindowPointerUp);
    }

    private endHold() {
        this.hold = null;
        window.removeEventListener('pointermove', this.onWindowPointerMove);
        window.removeEventListener('pointerup', this.onWindowPointerUp);
        window.removeEventListener('pointercancel', this.onWindowPointerUp);
    }

    private onCanvasPointerMove = (e: PointerEvent) => {
        if (!this.active || this.hold) return; // while held, the window listener handles it
        const screen = this.toScreen(e);
        this.last = screen;
        this.mapStore.setHoverTile(this.isOnMinimap(screen) ? null : this.tileAt(screen));
    };

    private onWindowPointerMove = (e: PointerEvent) => {
        const screen = this.toScreen(e);
        const prev = this.last ?? screen;
        this.last = screen;
        switch (this.hold) {
            case 'pan':
                this.camera.panByScreen(screen.x - prev.x, screen.y - prev.y);
                break;
            case 'minimap':
                this.moveByMinimap(screen);
                break;
            case 'paint': {
                const tile = this.tileAt(screen);
                this.mapStore.setHoverTile(tile);
                if (tile) this.mapStore.paint(tile);
                break;
            }
            case 'select':
                this.mapStore.setHoverTile(this.tileAt(screen));
                break;
        }
    };

    private onWindowPointerUp = (e: PointerEvent) => {
        const hold = this.hold;
        this.endHold();
        if (hold === 'select' && e.type === 'pointerup') {
            this.mapStore.setSelectedTile(this.tileAt(this.toScreen(e)));
        }
    };

    private onPointerLeave = () => {
        if (this.hold) return;
        this.last = null;
        this.mapStore.setHoverTile(null);
    };

    private onCameraMove = () => {
        if (!this.active || !this.last || this.hold === 'pan' || this.hold === 'minimap') return;
        const tile = this.tileAt(this.last);
        this.mapStore.setHoverTile(tile);
        if (this.hold === 'paint' && tile) this.mapStore.paint(tile);
    };

    private onContextMenu = (e: MouseEvent) => {
        e.preventDefault();
    };

    private onWheel = (e: WheelEvent) => {
        if (!this.active) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        // browsers turn Shift + wheel into a horizontal scroll
        const raw = e.shiftKey && e.deltaY === 0 ? e.deltaX : e.deltaY;
        const delta = Math.max(-300, Math.min(300, raw * unit));
        if (delta === 0) return;
        if (e.shiftKey) {
            // `event.shiftKey` rather than tracking key state by hand (the old keyup handler
            // compared against 'ctrl' and keydown against 'Ctrl', neither of which is a key name)
            this.mapStore.setBrushSize(this.mapStore.brushSize - Math.sign(delta));
            return;
        }
        this.camera.zoomAt(this.toScreen(e), Math.exp(-delta * 0.0015));
    };
}
