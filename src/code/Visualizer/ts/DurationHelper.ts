import { DeltaTime, Time } from 'time/Time';
import { Store } from './Store';
import { ZOOM_CONFIG } from './TimelineRender/zoomConfig';

export class DurationHelper {
    size = {
        width: 0,
        height: 0,
    };

    constructor(private store: Store) {}

    getDistanceFromTimestamp = (timestamp: Time) => {
        const timeOffset = timestamp.s - this.store.timelineStartTime.s;
        return timeOffset * this.timeToLengthFactor;
    };

    getTimestampFromDistance = (distance: number): Time => {
        const timeShift = DeltaTime.fromS(distance / this.timeToLengthFactor);
        return this.store.timelineStartTime.moveToFutureBy(timeShift);
    };

    cropTimeToTimelineTime = (time: Time) => {
        return Time.fromS(Math.max(this.store.timelineStartTime.s, Math.min(this.store.timelineEndTime.s, time.s)));
    };

    computeStartForZoom = (zoomLevel: number, xPosition: number) => {
        const time = this.getTimestampFromDistance(xPosition);
        const newFactor = this.size.width / ZOOM_CONFIG[zoomLevel].displayTime.s;
        const timeShoft = DeltaTime.fromS(xPosition / newFactor);
        return time.moveToHistoryBy(timeShoft);
    };

    get timeToLengthFactor() {
        return this.size.width / this.store.zoom.displayTime.s;
    }
}
