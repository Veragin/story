import { throttle } from 'code/utils/throttle';
import { DurationHelper } from './DurationHelper';
import { TimeManager } from 'time/TimeManager';
import { RESOLUTION_FACTOR } from './constants';
import { Store } from '../Store';
import { TimelineMouseListener } from './TimelineMouseListener';
import { TimelinePaint } from './TimelinePaint/TimelinePaint';
import { TimelineMarker } from './TimelineMarker';

export class TimelineRender {
    resizeObserver: ResizeObserver;
    durationHelper: DurationHelper;
    timelineMarker: TimelineMarker;
    timelineListener: TimelineMouseListener;
    timelinePaint: TimelinePaint;

    constructor(
        public canvasRef: HTMLCanvasElement,
        public containerRef: HTMLDivElement,
        public markerRef: HTMLDivElement,
        public timeManager: TimeManager,
        store: Store
    ) {
        this.durationHelper = new DurationHelper(store);
        this.timelineMarker = new TimelineMarker(markerRef, timeManager);
        this.timelinePaint = new TimelinePaint(store, timeManager, this.durationHelper, canvasRef);
        this.timelineListener = new TimelineMouseListener(canvasRef, store, this.durationHelper, this.timelineMarker);

        this.resizeObserver = new ResizeObserver(throttle<unknown>(() => this.onCanvasResize(), 10));
        this.resizeObserver.observe(containerRef);
        this.onCanvasResize();
    }

    onCanvasResize = () => {
        const rect = this.canvasRef.getBoundingClientRect();

        this.canvasRef.width = rect.width * RESOLUTION_FACTOR;
        this.canvasRef.height = rect.height * RESOLUTION_FACTOR;

        this.durationHelper.data.width = this.canvasRef.width / RESOLUTION_FACTOR;
        this.durationHelper.data.height = this.canvasRef.height;
        this.timelinePaint.timelineDraw.rescale();
        this.timelinePaint.render();
    };

    render = () => {
        this.timelinePaint.render();
    };

    destructor = () => {
        this.resizeObserver.disconnect();
        this.timelineListener.destructor();
        this.timelineMarker.destructor();
    };
}
