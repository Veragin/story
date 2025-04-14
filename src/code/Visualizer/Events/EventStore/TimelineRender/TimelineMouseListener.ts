import { throttle } from 'code/utils/throttle';
import { ZOOM_SPEED_FACTOR } from './constants';
import { EventStore } from '../EventStore';
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
        private store: EventStore,
        private timelineMarker: TimelineMarker
    ) {
        this.container.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
        this.container.addEventListener('mousemove', this.onMouseMove);
        this.container.addEventListener('wheel', this.onWheelEvent);
        this.container.addEventListener('mouseenter', this.onMouseEnter);
        this.container.addEventListener('mouseleave', this.onMouseLeave);
    }

    getTimeShift(e: MouseEvent) {
        const delta = this.mouseDownXPosition - e.clientX;
        return DeltaTime.fromS(delta / this.timeToLengthFactor);
    }

    private onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
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

    private onMouseMove = throttle((e: MouseEvent) => {
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

    private onWheelEvent = (e: WheelEvent) => {
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
        this.container.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
        this.container.removeEventListener('mousemove', this.onMouseMove);
        this.container.removeEventListener('wheel', this.onWheelEvent);
        this.container.removeEventListener('mouseenter', this.onMouseEnter);
        this.container.removeEventListener('mouseleave', this.onMouseLeave);
    }
}
