import { CanvasManager } from 'code/Visualizer/Graphs/CanvasManager';
import { Store } from '../Store';
import { register } from 'data/register';
import { TEventId } from 'types/TIds';
import { TEvent } from 'types/TEvent';

export class TimelineEvents {
    constructor(
        public store: Store,
        public canvasManager: CanvasManager
    ) {
        const eventListId = Object.keys(register.events) as TEventId[];
        eventListId.forEach((eventId) => {});
    }

    render = () => {
        this.canvasManager.draw();
    };

    destroy = () => {
        this.canvasManager.destroy();
    };
}
