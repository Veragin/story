import { CanvasManager } from 'code/Visualizer/Graphs/CanvasManager';
import { Store } from '../Store';
import { register } from 'data/register';
import { TEventId } from 'types/TIds';
import { TEvent } from 'types/TEvent';
import { EventNode } from './EventNode';
import { TLocationId } from 'types/TLocation';

type TLocationLayout = {
    events: TEvent<TEventId>[];
    rowCount: number;
    rowCountFromTop: number;
};

export class TimelineEvents {
    locationLayout: Partial<Record<TLocationId, TLocationLayout>> = {};
    mapping = new Map<TEventId, EventNode<TEventId>>();

    constructor(
        public store: Store,
        public canvasManager: CanvasManager
    ) {
        const eventList = Object.values(register.events) as TEvent<TEventId>[];
        eventList.forEach((event) => this.addEvent(event));
        this.recompueLocationLayout();
    }

    private recompueLocationLayout = () => {
        this.locationLayout = {};
        const eventList = Object.values(register.events) as TEvent<TEventId>[];

        eventList.forEach((event) => {
            const data = this.locationLayout[event.location];
            let node = this.mapping.get(event.eventId);
            if (node === undefined) {
                node = this.addEvent(event);
            }

            if (data === undefined) {
                node.rowIndexInLocation = 0;
                this.locationLayout[event.location] = {
                    events: [event],
                    rowCount: 1,
                    rowCountFromTop: 0,
                };
                return;
            }

            const cropEvents = data.events.filter((e) => areEventsOverLaping(e, event));
            const maxRow = cropEvents.reduce(
                (max, e) => Math.max(max, this.mapping.get(e.eventId)?.rowIndexInLocation ?? 0),
                -1
            );

            node.rowIndexInLocation = maxRow + 1;
            data.events.push(event);
            data.rowCount = Math.max(data.rowCount, maxRow + 2);
        });

        const locations = Object.values(this.locationLayout) as TLocationLayout[];
        let top = 0;
        locations.forEach((location) => {
            location.rowCountFromTop = top;
            top += location.rowCount;
        });

        this.mapping.forEach((event) => {
            const data = this.locationLayout[event.event.location];
            if (data) {
                const row = data.rowCountFromTop + event.rowIndexInLocation;
                event.box.updateRow(row);
            }
        });
    };

    addEvent = (event: TEvent<TEventId>) => {
        const node = new EventNode(event);
        node.box.setupNodes(this.canvasManager, () => {
            node.updateEventFromPosition(this.store);
            this.recompueLocationLayout();
        });

        this.mapping.set(event.eventId, node);
        return node;
    };

    removeEvent = (eventId: TEventId) => {
        const node = this.mapping.get(eventId);
        if (node) {
            node.box.destroyNodes(this.canvasManager);
            this.mapping.delete(eventId);
        }
    };

    render = () => {
        this.mapping.forEach((node) => {
            node.updateNodeByEvent(this.store);
        });
        this.canvasManager.draw();
    };

    destroy = () => {
        this.canvasManager.destroy();
        this.mapping.forEach((node) => {
            node.box.destroyNodes(this.canvasManager);
        });
        this.mapping.clear();
    };
}

const areEventsOverLaping = (event1: TEvent<TEventId>, event2: TEvent<TEventId>) => {
    return (
        !event1.timeRange.start.isAfter(event2.timeRange.end) && !event2.timeRange.start.isAfter(event1.timeRange.end)
    );
};
