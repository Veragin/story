import { action, makeObservable, observable } from 'mobx';
import { ZOOM_CONFIG } from './TimelineRender/zoomConfig';
import { TimelineRender } from './TimelineRender/TimelineRender';
import { Time } from 'time/Time';
import { TimeManager } from 'time/TimeManager';
import { CanvasHandler } from './CanvasHandler';
import { CanvasManager } from '../Graphs/CanvasManager';

export class Store {
    canvasManager: CanvasManager | null = null;
    canvasHandler: CanvasHandler | null = null;
    timelineRender: TimelineRender | null = null;

    constructor(public timeManager: TimeManager) {
        makeObservable(this, {
            displayConnections: observable,
            zoomLevel: observable,
            setDisplayConnections: action,
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
        this.timelineRender = new TimelineRender(timelineRef, markerRef, this.timeManager, this);
        this.canvasHandler = new CanvasHandler(mainRef, timelineRef, containerRef, () => {
            this.canvasManager?.draw();
            this.timelineRender?.render();
        });
    };

    deinit = () => {
        this.canvasManager?.destroy();
        this.timelineRender?.destructor();
        this.canvasHandler?.destructor();
    };

    displayConnections = false;
    setDisplayConnections = (value: boolean) => {
        this.displayConnections = value;
    };

    zoomLevel = 1;
    setZoomLevel = (value: number) => {
        this.zoomLevel = Math.min(ZOOM_CONFIG.length, Math.max(0, value));
        this.timelineRender?.render();
    };

    get zoom() {
        return ZOOM_CONFIG[this.zoomLevel];
    }

    timelineStartTime = Time.fromS(0);
    setTimelineStartTime = (time: Time) => {
        this.timelineStartTime = Time.max(time, Time.fromS(0));
        this.timelineRender?.render();
    };
}
