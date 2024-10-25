import { DeltaTime, Time } from 'time/Time';
import { Store } from '../Store';
import { ZOOM_CONFIG } from './zoomConfig';

export class DurationHelper {
    data = {
        width: 0,
        height: 0,
    };

    constructor(private store: Store) {}

    getDistanceFromTimestamp = (timestamp: Time) => {
        const timeOffset = timestamp.s - this.store.timelineStartTime.s;
        return timeOffset * this.getTimeToLengthFactor();
    };

    getTimestampFromDistance = (distance: number): Time => {
        const timeShift = DeltaTime.fromS(distance / this.getTimeToLengthFactor());
        return this.store.timelineStartTime.moveToFutureBy(timeShift);
    };

    cropTimeToTimelineTime = (time: Time) => {
        return Time.fromS(
            Math.max(
                this.store.timelineStartTime.s,
                Math.min(this.store.timelineStartTime.moveToFutureBy(this.store.zoom.displayTime).s, time.s)
            )
        );
    };

    getTimeToLengthFactor = () => {
        return this.data.width / this.store.zoom.displayTime.s;
    };

    computeStartForZoom = (zoomLevel: number, xPosition: number) => {
        const time = this.getTimestampFromDistance(xPosition);
        const newFactor = this.data.width / ZOOM_CONFIG[zoomLevel].displayTime.s;
        const timeShoft = DeltaTime.fromS(xPosition / newFactor);
        return time.moveToHistoryBy(timeShoft);
    };
}
