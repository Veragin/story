import { TimeManager } from 'time/TimeManager';
import { EventStore } from './EventStore/EventStore';
import { action, makeObservable, observable } from 'mobx';
import { TEventId } from 'types/TIds';
import { CanvasHandler } from './CanvasHandler';

export class Store {
    eventStore: EventStore;
    canvasHandler: CanvasHandler;

    constructor(public timeManager: TimeManager) {
        this.eventStore = new EventStore(timeManager, this);
        this.canvasHandler = new CanvasHandler(document.body, this);

        makeObservable(this, {
            activeEvent: observable,
            setActiveEvent: action,
        });
    }

    activeEvent: TEventId | null = null;
    setActiveEvent = (id: TEventId | null) => {
        this.activeEvent = id;
    };

    updateSize = (width: number, height: number) => {
        this.eventStore.durationHelper.size.width = width;
        this.eventStore.durationHelper.size.height = height;

        this.eventStore.render();
    };
}
