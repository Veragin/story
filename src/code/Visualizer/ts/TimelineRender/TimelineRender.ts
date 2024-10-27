import { DurationHelper } from './DurationHelper';
import { TimeManager } from 'time/TimeManager';
import { RESOLUTION_FACTOR } from './constants';
import { Store } from '../Store';
import { TimelineMouseListener } from './TimelineMouseListener';
import { TimelinePaint } from './TimelinePaint/TimelinePaint';
import { TimelineMarker } from './TimelineMarker';

export class TimelineRender {
    durationHelper: DurationHelper;
    timelineMarker: TimelineMarker;
    timelineListener: TimelineMouseListener;
    timelinePaint: TimelinePaint;

    constructor(
        public canvasRef: HTMLCanvasElement,
        public markerRef: HTMLDivElement,
        public timeManager: TimeManager,
        store: Store
    ) {
        this.durationHelper = new DurationHelper(store);
        this.timelineMarker = new TimelineMarker(markerRef, timeManager);
        this.timelinePaint = new TimelinePaint(store, timeManager, this.durationHelper, canvasRef);
        this.timelineListener = new TimelineMouseListener(canvasRef, store, this.durationHelper, this.timelineMarker);
    }

    render = () => {
        this.durationHelper.data.width = this.canvasRef.width / RESOLUTION_FACTOR;
        this.durationHelper.data.height = this.canvasRef.height / RESOLUTION_FACTOR;
        this.timelinePaint.render();
    };

    destructor = () => {
        this.timelineListener.destructor();
        this.timelineMarker.destructor();
    };
}
