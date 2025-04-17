import { MapStore } from '../MapStore';
import { MINIMAP_RATIO } from './constants';

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
        if (event.key === 'd') this.user.key.pressingRight = true;
        else if (event.key === 'a') this.user.key.pressingLeft = true;
        else if (event.key === 'w') this.user.key.pressingUp = true;
        else if (event.key === 's') this.user.key.pressingDown = true;
        else if (event.key === 'Ctrl') this.user.mouse.multiselect = true;
        else if (event.key === 'Shift') this.user.key.pressingShift = true;
    };

    private onKeyUp = (event: KeyboardEvent) => {
        if (event.key === 'd') this.user.key.pressingRight = false;
        else if (event.key === 'a') this.user.key.pressingLeft = false;
        else if (event.key === 'w') this.user.key.pressingUp = false;
        else if (event.key === 's') this.user.key.pressingDown = false;
        else if (event.key === 'ctrl')
            //ctrl
            this.user.mouse.multiselect = false;
        else if (event.key === 'Shift') this.user.key.pressingShift = false;
    };

    private onMouseDown = (event: MouseEvent) => {
        if (event.button !== 1) {
            return;
        }

        this.user.mouse.hold = true;
        this.user.mouse.last.x = this.user.mouse.pos.x + this.user.pos.x;
        this.user.mouse.last.y = this.user.mouse.pos.y + this.user.pos.y;
    };

    onMouseUp = (event: MouseEvent) => {
        if (this.canvas === null) return;
        if (event.button !== 1) {
            return;
        }
        if (!this.user.mouse.hold) return;

        this.user.mouse.hold = false;
        if (this.user.mouse.pointingTo === -2) {
            this.process.minimapMove(this.map, this.canvas);
        } else {
            this.process.fillColorToPointing(this.map);
        }
    };

    onMouseMove = (event: MouseEvent) => {
        if (this.canvas === null) return;
        this.user.mouse.pos.x = event.clientX - this.canvas.width / 2;
        this.user.mouse.pos.y = event.clientY - this.canvas.height / 2;

        const minimapWidth = this.canvas.width * MINIMAP_RATIO;
        const minimapHeight = this.canvas.height * MINIMAP_RATIO;
        if (event.clientX < minimapWidth && event.clientY > this.canvas.height - minimapHeight) {
            this.user.mouse.pointingTo = -2;
            if (this.user.mouse.hold) {
                this.process.minimapMove(this.map, this.canvas);
            }
        } else {
            this.user.mouse.pointingTo = 0;
            this.process.findSelectedTile();
            if (this.user.mouse.hold) {
                this.process.fillColorToPointing(this.map);
                this.mapStore.render();
            }
        }
    };

    onResize = () => {
        if (this.canvas === null) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    };

    onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
    };

    onWheel = (e: WheelEvent) => {
        if (this.user.key.pressingShift) {
            this.mapStore.setZoomLevel(this.mapStore.zoomLevel + Math.sign(e.deltaY));
            return;
        }
        this.user.mouse.size = Math.max(1, this.user.mouse.size + Math.sign(e.deltaY));
    };
}
