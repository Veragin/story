import { TimeManager } from 'time/TimeManager';
import { Store } from '../../Store';
import { TimelineDraw } from './TimelineDraw';

export class TimelinePaint {
    timelineDraw: TimelineDraw;

    constructor(
        private store: Store,
        private timeManager: TimeManager,
        canvas: HTMLCanvasElement
    ) {
        this.timelineDraw = new TimelineDraw(canvas);
    }

    render = () => {
        requestAnimationFrame(() => {
            this.timelineDraw.drawTimelineBorder();
            this.renderLabels();
        });
    };

    private renderLabels = () => {
        const zoom = this.store.zoom;
        const start = this.store.timelineStartTime;
        const end = this.store.timelineEndTime;

        const labelsTimes: Time[] = [];
        let time = this.timeManager.roundTo(start, zoom.labelsDistance);

        while (time.isBefore(end)) {
            if (time.isAfter(start)) {
                labelsTimes.push(time);
            }
            time = time.moveToFutureBy(zoom.labelsDistance);
        }

        for (const labelTime of labelsTimes) {
            const label = this.timeManager.renderTime(labelTime, zoom.renderedTimeFormat);
            this.timelineDraw.drawTimelineLabel(this.store.durationHelper.getDistanceFromTimestamp(labelTime), label);
        }
    };
}
