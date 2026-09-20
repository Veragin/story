import { MapStore } from '../MapStore';
import { minimapSize } from './utils';

export class MouseListener {
    canvas: HTMLCanvasElement | null = null;

    constructor(private mapStore: MapStore) {}

    private get user() {
        return this.mapStore.user;
    }

    private get map() {
        return this.mapStore.data;
    }

    private get process() {
        return this.mapStore.process;
    }

    init = (canvas: HTMLCanvasElement) => {
        this.canvas = canvas;
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        canvas.addEventListener('mousedown', this.onMouseDown);
        canvas.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('resize', this.onResize);
        document.addEventListener('contextmenu', this.onContextMenu);
        document.addEventListener('wheel', this.onWheel);
    };

    deinit = () => {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        this.canvas?.removeEventListener('mousedown', this.onMouseDown);
        this.canvas?.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('resize', this.onResize);
        document.removeEventListener('contextmenu', this.onContextMenu);
        document.removeEventListener('wheel', this.onWheel);
        this.canvas = null;
    };

    private onKeyDown = (chapter: KeyboardEvent) => {
        if (chapter.key === 'd') this.user.key.right = true;
        else if (chapter.key === 'a') this.user.key.left = true;
        else if (chapter.key === 'w') this.user.key.up = true;
        else if (chapter.key === 's') this.user.key.down = true;
        else if (chapter.key === 'Ctrl') this.user.key.ctrl = true;
        else if (chapter.key === 'Shift') this.user.key.shift = true;
    };

    private onKeyUp = (chapter: KeyboardEvent) => {
        if (chapter.key === 'd') this.user.key.right = false;
        else if (chapter.key === 'a') this.user.key.left = false;
        else if (chapter.key === 'w') this.user.key.up = false;
        else if (chapter.key === 's') this.user.key.down = false;
        else if (chapter.key === 'ctrl') this.user.key.ctrl = false;
        else if (chapter.key === 'Shift') this.user.key.shift = false;
    };

    private onMouseDown = (chapter: MouseEvent) => {
        if (chapter.button !== 0) {
            return;
        }
        this.user.mouse.hold = true;
        this.user.mouse.pointingTo = this.isOnMinimap() ? 'minimap' : 'map';
    };

    onMouseUp = (chapter: MouseEvent) => {
        if (this.canvas === null) return;
        if (chapter.button !== 0) {
            return;
        }
        if (!this.user.mouse.hold) return;

        this.user.mouse.hold = false;
        if (this.user.mouse.pointingTo === 'minimap') {
            this.process?.minimapMove(this.canvas);
        } else {
            if (this.mapStore.mode === 'palette') {
                this.process?.fillColorToPointing();
                this.process?.displayInfo();
            } else {
                this.mapStore.setSelectedTile(this.user.mouse.poinTo);
            }
        }
        this.mapStore.render();
    };

    onMouseMove = (chapter: MouseEvent) => {
        if (this.canvas === null) return;

        const rect = this.canvas.getBoundingClientRect();
        this.user.mouse.pos.x = chapter.clientX - rect.left;
        this.user.mouse.pos.y = chapter.clientY - rect.top;

        if (this.user.mouse.pointingTo === 'minimap') {
            if (this.user.mouse.hold && this.isOnMinimap()) {
                this.process?.minimapMove(this.canvas);
            }
        } else {
            this.process?.findSelectedTile();
            if (this.user.mouse.hold) {
                this.process?.fillColorToPointing();
                this.mapStore.render();
            }
            this.process?.displayInfo();
        }
        this.mapStore.render();
    };

    private isOnMinimap = () => {
        if (this.canvas === null) return false;
        const minimap = minimapSize(this.canvas, this.map);

        return (
            this.mapStore.showMinimap &&
            this.user.mouse.pos.x < minimap.width &&
            this.user.mouse.pos.y > this.canvas.height - minimap.height
        );
    };

    onResize = () => {
        if (this.canvas === null) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.mapStore.render();
    };

    onContextMenu = (chapter: MouseEvent) => {
        chapter.preventDefault();
    };

    onWheel = (e: WheelEvent) => {
        if (this.user.key.shift) {
            this.mapStore.setZoomLevel(this.mapStore.zoomLevel + Math.sign(e.deltaY));
            return;
        }
        this.user.mouse.size = Math.max(1, this.user.mouse.size + Math.sign(e.deltaY));
        this.mapStore.render();
    };
}
