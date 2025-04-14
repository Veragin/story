import { TimeManager } from 'time/TimeManager';
import { EventStore } from '../EventStore';
import { TimelineMouseListener } from './TimelineMouseListener';
import { TimelinePaint } from './TimelinePaint/TimelinePaint';
import { TimelineMarker } from './TimelineMarker';

export class TimelineRender {
    timelineMarker: TimelineMarker;
    timelineListener: TimelineMouseListener;
    timelinePaint: TimelinePaint;

    constructor(
        public canvasRef: HTMLCanvasElement,
        public markerRef: HTMLDivElement,
        public timeManager: TimeManager,
        store: EventStore
    ) {
        this.timelineMarker = new TimelineMarker(markerRef, timeManager);
        this.timelinePaint = new TimelinePaint(store, timeManager, canvasRef);
        this.timelineListener = new TimelineMouseListener(canvasRef, store, this.timelineMarker);
    }

    render = () => {
        this.timelinePaint.render();
    };

    destroy = () => {
        this.timelineListener.destructor();
        this.timelineMarker.destructor();
    };
}
