import { action, makeObservable, observable } from 'mobx';
import { ZOOM_CONFIG } from './zoomConfig';
import { TimelineRender } from './TimelineRender';

export class Store {
    timelineRender = new TimelineRender();

    constructor() {
        makeObservable(this, {
            displayConnections: observable,
            zoomLevel: observable,
            setDisplayConnections: action,
            setZoomLevel: action,
        });
    }

    displayConnections = false;
    setDisplayConnections = (value: boolean) => {
        this.displayConnections = value;
    };

    zoomLevel = 1;
    setZoomLevel = (value: number) => {
        this.zoomLevel = Math.min(ZOOM_CONFIG.length, Math.max(0, value));
    };
}
