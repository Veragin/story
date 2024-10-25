import { throttle } from 'code/utils/throttle';
import { DurationHelper } from './DurationHelper';
import { TimeManager } from 'time/TimeManager';
import { RESOLUTION_FACTOR } from './constants';
import { TimelineDraw } from './TimelineDraw';
import { Store } from './Store';
import { TimelineMouseListener } from './TimelineMouseListener';

export class TimelineRender {
    isMouseButtonDown: boolean;
    resizeObserver: ResizeObserver;
    durationHelper: DurationHelper;
    timelineDraw: TimelineDraw;
    timelineListener: TimelineMouseListener;

    constructor(
        public canvasRef: HTMLCanvasElement,
        public containerRef: HTMLDivElement,
        public timeManager: TimeManager,
        private store: Store
    ) {
        this.isMouseButtonDown = false;
        this.timelineDraw = new TimelineDraw(canvasRef);
        this.durationHelper = new DurationHelper(store);
        this.timelineListener = new TimelineMouseListener(canvasRef, store);

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
        this.timelineDraw.rescale();
        this.render();
    };

    render = () => {
        this.timelineDraw.drawTimelineBorder();
        this.renderLabels();
    };

    renderLabels = () => {
        const zoom = this.store.zoom;
        const start = this.store.timelineStartTime;
        const end = this.store.timelineStartTime.moveToFutureBy(zoom.displayTime);

        const labelsTimes: Time[] = [];
        let time = this.timeManager.roundTo(start, zoom.labelsDistance);

        while (time.isBefore(end)) {
            if (time.isAfter(start)) {
                labelsTimes.push(time);
            }
            time = time.moveToFutureBy(zoom.labelsDistance);
        }

        for (const labelTime of labelsTimes) {
            const label = this.timeManager.renderTime(labelTime, zoom.renderedTimeFormat);
            this.timelineDraw.drawTimelineLabel(this.durationHelper.getDistanceFromTimestamp(labelTime), label);
        }
    };

    destroy = () => {
        this.resizeObserver.disconnect();
    };
}
