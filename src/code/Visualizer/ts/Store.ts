import { action, makeObservable, observable } from 'mobx';
import { ZOOM_CONFIG } from './TimelineRender/zoomConfig';
import { TimelineRender } from './TimelineRender/TimelineRender';
import { Time } from 'time/Time';
import { TimeManager } from 'time/TimeManager';
import { CanvasHandler } from './CanvasHandler';
import { CanvasManager } from '../Graphs/CanvasManager';
import { TimelineEvents } from './TimelineEvents/TimelineEvents';
import { DurationHelper } from './DurationHelper';

export class Store {
    canvasManager: CanvasManager | null = null;
    durationHelper: DurationHelper;
    timelineEvents: TimelineEvents | null = null;
    canvasHandler: CanvasHandler | null = null;
    timelineRender: TimelineRender | null = null;

    constructor(public timeManager: TimeManager) {
        this.durationHelper = new DurationHelper(this);
        makeObservable(this, {
            displayConnections: observable,
            zoomLevel: observable,
            dragMode: observable,
            toggleDragMode: action,
            toggleDisplayConnections: action,
            setZoomLevel: action,
        });
    }

    init = (
        mainRef: HTMLCanvasElement,
        timelineRef: HTMLCanvasElement,
        containerRef: HTMLDivElement,
        markerRef: HTMLDivElement
    ) => {
        this.deinit();

        this.canvasManager = new CanvasManager(mainRef);
        this.timelineEvents = new TimelineEvents(this, this.canvasManager);
        this.timelineRender = new TimelineRender(timelineRef, markerRef, this.timeManager, this);
        this.canvasHandler = new CanvasHandler(mainRef, timelineRef, containerRef, this);
    };

    deinit = () => {
        this.timelineEvents?.destroy();
        this.timelineRender?.destroy();
        this.canvasHandler?.destroy();
    };

    displayConnections = false;
    toggleDisplayConnections = () => {
        this.displayConnections = !this.displayConnections;
    };

    zoomLevel = 3;
    setZoomLevel = (value: number) => {
        this.zoomLevel = Math.min(ZOOM_CONFIG.length, Math.max(0, value));
        this.render();
    };

    timelineStartTime = Time.fromS(0);
    setTimelineStartTime = (time: Time) => {
        this.timelineStartTime = Time.max(time, Time.fromS(0));
        this.render();
    };

    dragMode = true;
    toggleDragMode = () => {
        this.dragMode = !this.dragMode;
        if (this.canvasManager) {
            this.canvasManager.dragMode = this.dragMode;
        }
    };

    render = () => {
        this.timelineEvents?.render();
        this.timelineRender?.render();
    };

    get zoom() {
        return ZOOM_CONFIG[this.zoomLevel];
    }

    get timelineEndTime() {
        return this.timelineStartTime.moveToFutureBy(this.zoom.displayTime);
    }
}
