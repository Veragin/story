import { action, makeObservable, observable } from 'mobx';
import { ZOOM_CONFIG } from './zoomConfig';
import { TimelineRender } from './TimelineRender';
import { Time } from 'time/Time';
import { TimeManager } from 'time/TimeManager';

export class Store {
    constructor(public timeManager: TimeManager) {
        makeObservable(this, {
            displayConnections: observable,
            zoomLevel: observable,
            setDisplayConnections: action,
            setZoomLevel: action,
        });
    }

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

    timelineRender: TimelineRender | null = null;
    setTimeRenderer = (canvasRef: HTMLCanvasElement, containerRef: HTMLDivElement) => {
        if (this.timelineRender !== null) {
            this.timelineRender.destroy();
        }

        this.timelineRender = new TimelineRender(canvasRef, containerRef, this.timeManager, this);
    };

    timelineStartTime = Time.fromS(0);
    setTimelineStartTime = (time: Time) => {
        this.timelineStartTime = Time.max(time, Time.fromS(0));
        this.timelineRender?.render();
    };
}
