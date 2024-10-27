import { throttle } from 'code/utils/throttle';
import { RESOLUTION_FACTOR } from './TimelineRender/constants';

export class CanvasHandler {
    resizeObserver: ResizeObserver;

    constructor(
        public mainCanvasRef: HTMLCanvasElement,
        public timelineRef: HTMLCanvasElement,
        public containerRef: HTMLDivElement,
        private render: () => void
    ) {
        this.resizeObserver = new ResizeObserver(throttle<unknown>(() => this.onCanvasResize(), 10));
        this.resizeObserver.observe(containerRef);
        this.onCanvasResize();
    }

    onCanvasResize = () => {
        const rect1 = this.mainCanvasRef.getBoundingClientRect();
        this.mainCanvasRef.width = rect1.width * RESOLUTION_FACTOR;
        this.mainCanvasRef.height = rect1.height * RESOLUTION_FACTOR;

        const rect2 = this.timelineRef.getBoundingClientRect();
        this.timelineRef.width = rect2.width * RESOLUTION_FACTOR;
        this.timelineRef.height = rect2.height * RESOLUTION_FACTOR;

        this.render();
    };

    destructor = () => {
        this.resizeObserver.disconnect();
    };
}
