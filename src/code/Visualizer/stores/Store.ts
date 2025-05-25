import { TimeManager } from 'time/TimeManager';
import { EventStore } from '../Events/EventStore/EventStore';
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
        this.agent = new Agent('http://localhost:3123');
        this.eventStore = new EventStore(timeManager, this);
        this.canvasHandler = new CanvasHandler(document.body, this);

        makeObservable(this, {
            activeTab: observable,
            modalContent: observable.ref,
            setActiveTab: action,
            setModalContent: action,
        });
    }

    activeTab: TActiveTab = null;
    setActiveTab = (tab: TActiveTab | null) => {
        this.activeTab = tab;
        this.modalContent = null;
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

    destroy = () => {
        this.canvasHandler.destroy();
        this.eventStore.deinit();
    };
}

type TActiveTab =
    | null
    | {
          tab: 'event';
          eventId: TEventId;
      }
    | {
          tab: 'map';
          mapId: string;
      };
