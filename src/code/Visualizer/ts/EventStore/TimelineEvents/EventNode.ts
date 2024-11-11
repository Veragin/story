import { TEvent } from 'types/TEvent';
import { TEventId } from 'types/TIds';
import { EventStore } from '../EventStore';
import { EventNodeBox } from './EventNodeBox';

export class EventNode<E extends TEventId> {
    box: EventNodeBox<E>;
    rowIndexInLocation: number = 0;

    constructor(public event: TEvent<E>) {
        this.box = new EventNodeBox(event);
    }

    updateNodeByEvent = (store: EventStore) => {
        const x = (this.event.timeRange.start.s - store.timelineStartTime.s) * store.durationHelper.timeToLengthFactor;
        const width =
            (this.event.timeRange.end.s - this.event.timeRange.start.s) * store.durationHelper.timeToLengthFactor;

        this.box.update({ x, width, title: this.event.title });
    };

    updateEventFromPosition = (store: EventStore) => {
        const start = store.durationHelper.getTimestampFromDistance(this.box.start);
        const end = store.durationHelper.getTimestampFromDistance(this.box.end);

        this.event.timeRange.start = start;
        this.event.timeRange.end = end;
    };
}
