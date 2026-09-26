import { TimeManager } from '@story/shared';
import { action, makeObservable, observable } from 'mobx';
import { CanvasHandler } from './CanvasHandler';
import { Agent } from './Agent';
import { api, type TVisualizerApi } from '../api';
import { ReactNode } from 'react';

export class Store {
    canvasHandler: CanvasHandler;
    /** The typed Visualizer API (`client/src/api`) — real server via the `/api` proxy, or the mock. */
    api: TVisualizerApi = api;
    /** Legacy adapter over `api` for the pre-WP1 forms and map page. */
    agent: Agent;

    constructor(public timeManager: TimeManager) {
        this.agent = new Agent(this.api);
        this.canvasHandler = new CanvasHandler(document.body);

        makeObservable(this, {
            modalContent: observable.ref,
            setModalContent: action,
        });
    }

    modalContent: ReactNode | null = null;
    setModalContent = (content: ReactNode | null) => {
        this.modalContent = content;
    };

    destroy = () => {
        this.canvasHandler.destroy();
    };
}
