import { throttle } from 'code/utils/throttle';
import { ZOOM_SPEED_FACTOR } from './constants';
import { Store } from '../Store';
import { ZOOM_CONFIG } from './zoomConfig';
import { DeltaTime, Time } from 'time/Time';
import { DurationHelper } from './DurationHelper';

export class TimelineMouseListener {
    private isMouseDown = false;
    private isDragging = false;

    private timeToLengthFactor: number = 1;
    private mouseXPosition: number = 1;
    private mouseDownTime = Time.fromS(0);
    private zoomLevelProgress: number = 0;

    constructor(
        private container: HTMLCanvasElement,
        private store: Store,
        private durationHelper: DurationHelper
    ) {
        this.container.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
        this.container.addEventListener('mousemove', this.onMouseMove);
        this.container.addEventListener('wheel', this.onWheelEvent);
    }

    getTimeShift(e: MouseEvent) {
        const delta = this.mouseXPosition - e.clientX;
        return DeltaTime.fromS(delta / this.timeToLengthFactor);
    }

    private onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        this.isMouseDown = true;
        this.timeToLengthFactor = this.container.offsetWidth / this.store.zoom.displayTime.s;
    };

    private onMouseUp = () => {
        this.isMouseDown = false;
        this.isDragging = false;
    };

    private onMouseMove = throttle((e: MouseEvent) => {
        if (this.isMouseDown) {
            if (!this.isDragging) {
                this.isDragging = true;
                this.mouseXPosition = e.clientX;
                this.mouseDownTime = this.store.timelineStartTime;
            }

            const timeShift = this.getTimeShift(e);
            const newTime = this.mouseDownTime.moveToFutureBy(timeShift);
            this.store.setTimelineStartTime(newTime);
        }
    }, 30);

    private onWheelEvent = (e: WheelEvent) => {
        // crop step to interval (-1, 1)
        const zoomStep = Math.max(Math.min(e.deltaY * ZOOM_SPEED_FACTOR, 1), -1);
        const zoomLevelProgress = this.zoomLevelProgress - zoomStep;
        if (zoomLevelProgress < 0 || zoomLevelProgress > ZOOM_CONFIG.length - 1) {
            // you jumped out of boundery => do nothing
            return;
        }

        this.zoomLevelProgress = zoomLevelProgress;
        const zoomLevel = Math.round(this.zoomLevelProgress);

        if (zoomLevel !== this.store.zoomLevel) {
            const newTime = this.durationHelper.computeStartForZoom(zoomLevel, e.clientX);
            this.store.setZoomLevel(zoomLevel);
            this.store.setTimelineStartTime(newTime);
        }
    };

    destructor() {
        this.container.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
        this.container.removeEventListener('mousemove', this.onMouseMove);
        this.container.removeEventListener('wheel', this.onWheelEvent);
    }
}
