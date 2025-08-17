import { TimeManager } from 'time/TimeManager';
import { ChapterStore } from '../ChapterStore';
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
        store: ChapterStore
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
