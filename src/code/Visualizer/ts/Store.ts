import { TimeManager } from 'time/TimeManager';
import { EventStore } from './EventStore/EventStore';
import { action, makeObservable, observable } from 'mobx';
import { TEventId } from 'types/TIds';

export class Store {
    eventStore: EventStore;

    constructor(public timeManager: TimeManager) {
        this.eventStore = new EventStore(timeManager, this);

        makeObservable(this, {
            activeEvent: observable,
            setActiveEvent: action,
        });
    }

    activeEvent: TEventId | null = null;
    setActiveEvent = (id: TEventId | null) => {
        this.activeEvent = id;
    };
}
