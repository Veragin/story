import { CanvasManagerCore } from './CanvasManagerCore';
import { CanvasWorld, TPoint } from './CanvasWorld';
import { GuiEventDispatcher } from './EventDispatcher';

export class CanvasEventManager {
    private canvas: HTMLCanvasElement;
    private canvasWorld: CanvasWorld;
    private eventDispatcher: GuiEventDispatcher;

    constructor(canvas: HTMLCanvasElement, canvasWorld: CanvasWorld, eventDispatcher: GuiEventDispatcher) {
        this.canvas = canvas;
        this.canvasWorld = canvasWorld;
        this.eventDispatcher = eventDispatcher;
        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.addEventListener('click', this.handleClick);
        this.canvas.addEventListener('dblclick', this.handleDblClick);
        this.canvas.addEventListener('contextmenu', this.handleContextMenu);
        this.canvas.addEventListener('wheel', this.handleWheel);
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
    }

    private getMousePoint(event: MouseEvent | WheelEvent): TPoint {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.clientWidth / rect.width;
        const scaleY = this.canvas.clientHeight / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };
    }

    private handleMouseDown = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);
        this.eventDispatcher.dispatchMouseDown(event, screenPoint, worldPoint);
    };

    private handleMouseMove = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        this.eventDispatcher.dispatchMouseMove(event, screenPoint);
    };

    private handleMouseUp = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);
        this.eventDispatcher.dispatchMouseUp(event, screenPoint, worldPoint);
    };

    private handleMouseLeave = () => {
        this.eventDispatcher.dispatchMouseLeave();
    };

    private handleClick = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);
        this.eventDispatcher.dispatchClick(event, screenPoint, worldPoint);
    };

    private handleDblClick = (event: MouseEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);
        this.eventDispatcher.dispatchDblClick(event, screenPoint, worldPoint);
    };

    private handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        return false;
    };

    private handleWheel = (event: WheelEvent) => {
        const screenPoint = this.getMousePoint(event);
        const worldPoint = this.canvasWorld.screenToWorld(screenPoint);
        this.eventDispatcher.dispatchWheel(event, screenPoint, worldPoint);
    };

    private handleKeyDown = (event: KeyboardEvent) => {
        this.eventDispatcher.dispatchKeyDown(event);
    };

    private handleKeyUp = (event: KeyboardEvent) => {
        this.eventDispatcher.dispatchKeyUp(event);
    };

    destroy() {
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.removeEventListener('click', this.handleClick);
        this.canvas.removeEventListener('dblclick', this.handleDblClick);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
        this.canvas.removeEventListener('wheel', this.handleWheel);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
}