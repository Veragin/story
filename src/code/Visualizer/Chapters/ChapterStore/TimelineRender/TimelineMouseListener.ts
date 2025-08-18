import { throttle } from 'code/utils/throttle';
import { ZOOM_SPEED_FACTOR } from './constants';
import { ChapterStore } from '../ChapterStore';
import { ZOOM_CONFIG } from './zoomConfig';
import { DeltaTime, Time } from 'time/Time';
import { TimelineMarker } from './TimelineMarker';

export class TimelineMouseListener {
    private isMouseDown = false;
    private isDragging = false;

    private timeToLengthFactor: number = 1;
    private mouseDownXPosition: number = 1;
    private mouseDownTime = Time.fromS(0);
    private zoomLevelProgress: number = 0;

    constructor(
        private container: HTMLCanvasElement,
        private store: ChapterStore,
        private timelineMarker: TimelineMarker
    ) {
        this.container.addChapterListener('mousedown', this.onMouseDown);
        document.addChapterListener('mouseup', this.onMouseUp);
        this.container.addChapterListener('mousemove', this.onMouseMove);
        this.container.addChapterListener('wheel', this.onWheelChapter);
        this.container.addChapterListener('mouseenter', this.onMouseEnter);
        this.container.addChapterListener('mouseleave', this.onMouseLeave);
    }

    getTimeShift(e: MouseChapter) {
        const delta = this.mouseDownXPosition - e.clientX;
        return DeltaTime.fromS(delta / this.timeToLengthFactor);
    }

    private onMouseDown = (e: MouseChapter) => {
        e.prchapterDefault();
        this.isMouseDown = true;
        this.timeToLengthFactor = this.container.offsetWidth / this.store.zoom.displayTime.s;
        this.container.classList.add('grabbing');
    };

    private onMouseUp = () => {
        this.isMouseDown = false;
        this.isDragging = false;
        this.container.classList.remove('grabbing');
    };

    private onMouseEnter = () => {
        this.timelineMarker.show();
    };

    private onMouseLeave = () => {
        this.timelineMarker.hide();
    };

    private onMouseMove = throttle((e: MouseChapter) => {
        const mouseTime = this.store.durationHelper.getTimestampFromDistance(e.clientX);
        this.timelineMarker.update(e.clientX, mouseTime);

        if (this.isMouseDown) {
            if (!this.isDragging) {
                this.isDragging = true;
                this.mouseDownXPosition = e.clientX;
                this.mouseDownTime = this.store.timelineStartTime;
            }

            const timeShift = this.getTimeShift(e);
            const newTime = this.mouseDownTime.moveToFutureBy(timeShift);
            this.store.setTimelineStartTime(newTime);
        }
    }, 30);

    private onWheelChapter = (e: WheelChapter) => {
        const zoomStep = Math.max(Math.min(e.deltaY * ZOOM_SPEED_FACTOR, 1), -1);
        const zoomLevelProgress = this.zoomLevelProgress - zoomStep;
        if (zoomLevelProgress < 0 || zoomLevelProgress > ZOOM_CONFIG.length - 1) {
            // you jumped out of boundery => do nothing
            return;
        }

        this.zoomLevelProgress = zoomLevelProgress;
        const zoomLevel = Math.round(this.zoomLevelProgress);

        if (zoomLevel !== this.store.zoomLevel) {
            const newTime = this.store.durationHelper.computeStartForZoom(zoomLevel, e.clientX);
            this.store.setZoomLevel(zoomLevel);
            this.store.setTimelineStartTime(newTime);
        }
    };

    destructor() {
        this.container.removeChapterListener('mousedown', this.onMouseDown);
        document.removeChapterListener('mouseup', this.onMouseUp);
        this.container.removeChapterListener('mousemove', this.onMouseMove);
        this.container.removeChapterListener('wheel', this.onWheelChapter);
        this.container.removeChapterListener('mouseenter', this.onMouseEnter);
        this.container.removeChapterListener('mouseleave', this.onMouseLeave);
    }
}
