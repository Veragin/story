import { throttle } from '@story/shared';
import { RESOLUTION_FACTOR } from '../Chapters/ChapterStore/TimelineRender/constants';

export class CanvasHandler {
    resizeObserver: ResizeObserver;
    register: Map<string, HTMLCanvasElement> = new Map();

    constructor(public containerRef: HTMLElement) {
        this.resizeObserver = new ResizeObserver(throttle<unknown>(() => this.onCanvasResize(), 10));
        this.resizeObserver.observe(containerRef);
        this.onCanvasResize();
    }

    onCanvasResize = () => {
        this.register.forEach(this.updateCanvasSize);
    };

    private updateCanvasSize = (canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * RESOLUTION_FACTOR;
        canvas.height = rect.height * RESOLUTION_FACTOR;
    };

    registerCanvas = (id: string, canvas: HTMLCanvasElement) => {
        this.register.set(id, canvas);
        this.updateCanvasSize(canvas);
    };

    unregisterCanvas = (id: string) => {
        this.register.delete(id);
    };

    destroy = () => {
        this.resizeObserver.disconnect();
    };
}
