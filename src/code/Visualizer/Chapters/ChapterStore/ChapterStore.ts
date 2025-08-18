import { action, makeObservable, observable } from 'mobx';
import { ZOOM_CONFIG } from './TimelineRender/zoomConfig';
import { TimelineRender } from './TimelineRender/TimelineRender';
import { Time } from 'time/Time';
import { TimeManager } from 'time/TimeManager';
import { CanvasManager } from '../../GUIComponents/Graphs/CanvasManager';
import { TimelineChapters } from './TimelineChapters/TimelineChapters';
import { DurationHelper } from './DurationHelper';
import { Store } from '../../stores/Store';
import { createChapterModalContent } from 'code/Visualizer/Chapters/createChapterModalContent';

export class ChapterStore {
    canvasManager: CanvasManager | null = null;
    durationHelper: DurationHelper;
    timelineChapters: TimelineChapters | null = null;
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
        this.timelineChapters = new TimelineChapters(
            this,
            this.canvasManager,
            (id) => this.store.setActiveTab({ tab: 'chapter', chapterId: id }),
            (chapter) => this.store.setModalContent(createChapterModalContent(chapter))
        );
        this.timelineRender = new TimelineRender(timelineRef, markerRef, this.timeManager, this);
        this.store.canvasHandler.registerCanvas('timeline', timelineRef);
        this.store.canvasHandler.registerCanvas('main', mainRef);

        this.render();
    };

    deinit = () => {
        this.timelineChapters?.destroy();
        this.timelineRender?.destroy();
        this.canvasManager?.destroy();
        this.store.canvasHandler.unregisterCanvas('timeline');
        this.store.canvasHandler.unregisterCanvas('main');

        this.timelineChapters = null;
        this.timelineRender = null;
        this.canvasManager = null;
    };

    displayConnections = true;
    toggleDisplayConnections = () => {
        this.displayConnections = !this.displayConnections;
        if (this.displayConnections) {
            this.timelineChapters?.graph.showEdges();
        } else {
            this.timelineChapters?.graph.hideEdges();
        }
        this.timelineChapters?.render();
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
        this.timelineChapters?.render();
        this.timelineRender?.render();
    };

    get zoom() {
        return ZOOM_CONFIG[this.zoomLevel];
    }

    get timelineEndTime() {
        return this.timelineStartTime.moveToFutureBy(this.zoom.displayTime);
    }
}
