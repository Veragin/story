import { TEvent } from 'types/TEvent';
import { TEventId } from 'types/TIds';
import { Store } from '../Store';
import { EVENT_NODE_HEIGHT, EventNodeBox } from './EventNodeBox';

export class EventNode<E extends TEventId> {
    box: EventNodeBox<E>;

    constructor(public event: TEvent<E>) {
        this.box = new EventNodeBox(event);
    }

    update = (store: Store) => {
        const x = (this.event.timeRange.start.s - store.timelineStartTime.s) * store.durationHelper.timeToLengthFactor;
        const width =
            (this.event.timeRange.end.s - this.event.timeRange.start.s) * store.durationHelper.timeToLengthFactor;
        const height = EVENT_NODE_HEIGHT;
        const y = 0;

        this.box.update({ x, y, width, height, title: this.event.title });
    };
}
