import { CanvasManager } from 'code/Visualizer/Graphs/CanvasManager';
import { Store } from '../Store';
import { register } from 'data/register';
import { TEventId } from 'types/TIds';
import { TEvent } from 'types/TEvent';
import { EventNode } from './EventNode';

export class TimelineEvents {
    mapping = new Map<TEventId, EventNode<TEventId>>();

    constructor(
        public store: Store,
        public canvasManager: CanvasManager
    ) {
        const eventList = Object.values(register.events) as TEvent<TEventId>[];
        eventList.forEach((event) => this.addEvent(event));
    }

    addEvent = (event: TEvent<TEventId>) => {
        const node = new EventNode(event);
        node.box.setupNodes(this.canvasManager);

        this.mapping.set(event.eventId, node);
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
            node.update(this.store);
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
