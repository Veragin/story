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

    private onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'd') this.user.key.right = true;
        else if (event.key === 'a') this.user.key.left = true;
        else if (event.key === 'w') this.user.key.up = true;
        else if (event.key === 's') this.user.key.down = true;
        else if (event.key === 'Ctrl') this.user.key.ctrl = true;
        else if (event.key === 'Shift') this.user.key.shift = true;
    };

    private onKeyUp = (event: KeyboardEvent) => {
        if (event.key === 'd') this.user.key.right = false;
        else if (event.key === 'a') this.user.key.left = false;
        else if (event.key === 'w') this.user.key.up = false;
        else if (event.key === 's') this.user.key.down = false;
        else if (event.key === 'ctrl') this.user.key.ctrl = false;
        else if (event.key === 'Shift') this.user.key.shift = false;
    };

    private onMouseDown = (event: MouseEvent) => {
        if (event.button !== 1) {
            return;
        }
        this.user.mouse.hold = true;
    };

    onMouseUp = (event: MouseEvent) => {
        if (this.canvas === null) return;
        if (event.button !== 1) {
            return;
        }
        if (!this.user.mouse.hold) return;

        this.user.mouse.hold = false;
        if (this.user.mouse.pointingTo === -2) {
            this.process?.minimapMove(this.map, this.canvas);
        } else {
            this.process?.fillColorToPointing(this.map);
            this.process?.displayInfo();
        }
        this.mapStore.render();
    };

    onMouseMove = (event: MouseEvent) => {
        if (this.canvas === null) return;

        const rect = this.canvas.getBoundingClientRect();
        this.user.mouse.pos.x = event.clientX - rect.left;
        this.user.mouse.pos.y = event.clientY - rect.top;

        const minimap = minimapSize(this.canvas);
        if (event.clientX < minimap.width && event.clientY > this.canvas.height - minimap.height) {
            this.user.mouse.pointingTo = -2;
            if (this.user.mouse.hold) {
                this.process?.minimapMove(this.map, this.canvas);
            }
        } else {
            this.user.mouse.pointingTo = 0;
            this.process?.findSelectedTile();
            if (this.user.mouse.hold) {
                this.process?.fillColorToPointing(this.map);
                this.mapStore.render();
            }
            this.process?.displayInfo();
        }
        this.mapStore.render();
    };

    onResize = () => {
        if (this.canvas === null) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.mapStore.render();
    };

    onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
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
