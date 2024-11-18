import { action, makeObservable, observable } from 'mobx';
import { ZOOM_CONFIG } from './TimelineRender/zoomConfig';
import { TimelineRender } from './TimelineRender/TimelineRender';
import { Time } from 'time/Time';
import { TimeManager } from 'time/TimeManager';
import { CanvasManager } from '../../Graphs/CanvasManager';
import { TimelineEvents } from './TimelineEvents/TimelineEvents';
import { DurationHelper } from './DurationHelper';
import { Store } from '../Store';
import { createEventModalContent } from 'code/Visualizer/createEventModalContent';

export class EventStore {
    canvasManager: CanvasManager | null = null;
    durationHelper: DurationHelper;
    timelineEvents: TimelineEvents | null = null;
    timelineRender: TimelineRender | null = null;

    constructor(
        public timeManager: TimeManager,
        private store: Store
    ) {
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

    init = (mainRef: HTMLCanvasElement, timelineRef: HTMLCanvasElement, markerRef: HTMLDivElement) => {
        this.deinit();

        this.canvasManager = new CanvasManager(mainRef);
        this.timelineEvents = new TimelineEvents(
            this,
            this.canvasManager,
            (id) => this.store.setActiveEvent(id),
            (event) => this.store.setModalContent(createEventModalContent(event))
        );
        this.timelineRender = new TimelineRender(timelineRef, markerRef, this.timeManager, this);
        this.store.canvasHandler.registerCanvas('timeline', timelineRef);
        this.store.canvasHandler.registerCanvas('main', mainRef);

        this.render();
    };

    deinit = () => {
        this.timelineEvents?.destroy();
        this.timelineRender?.destroy();
        this.canvasManager?.destroy();
        this.store.canvasHandler.unregisterCanvas('timeline');
        this.store.canvasHandler.unregisterCanvas('main');

        this.timelineEvents = null;
        this.timelineRender = null;
        this.canvasManager = null;
    };

    displayConnections = true;
    toggleDisplayConnections = () => {
        this.displayConnections = !this.displayConnections;
        if (this.displayConnections) {
            this.timelineEvents?.graph.showEdges();
        } else {
            this.timelineEvents?.graph.hideEdges();
        }
        this.timelineEvents?.render();
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
