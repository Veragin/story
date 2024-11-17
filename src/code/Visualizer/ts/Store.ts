import { TimeManager } from 'time/TimeManager';
import { EventStore } from './EventStore/EventStore';
import { action, makeObservable, observable } from 'mobx';
import { TEventId } from 'types/TIds';
import { CanvasHandler } from './CanvasHandler';
import { Agent } from './Agent';
import { ReactNode } from 'react';

export class Store {
    eventStore: EventStore;
    canvasHandler: CanvasHandler;
    agent: Agent;

    constructor(public timeManager: TimeManager) {
        this.agent = new Agent('http://localhost:3000');
        this.eventStore = new EventStore(timeManager, this);
        this.canvasHandler = new CanvasHandler(document.body, this);

        makeObservable(this, {
            activeEvent: observable,
            modalContent: observable.ref,
            setActiveEvent: action,
            setModalContent: action,
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

    modalContent: ReactNode | null = null;
    setModalContent = (content: ReactNode | null) => {
        this.modalContent = content;
    };
}
