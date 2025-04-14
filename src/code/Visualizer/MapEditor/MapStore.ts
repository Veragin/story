import { action, makeObservable, observable } from 'mobx';
import { ZOOM_CONFIG } from '../Events/EventStore/TimelineRender/zoomConfig';
import { CanvasHandler } from '../stores/CanvasHandler';
import { TMapData } from './types';

export class MapStore {
    constructor(
        private canvasHandler: CanvasHandler,
        public data: TMapData
    ) {
        makeObservable(this, {
            editMode: observable,
            setEditMode: action,
            zoomLevel: observable,
            setZoomLevel: action,
        });
    }

    init = (mainRef: HTMLCanvasElement) => {
        this.deinit();

        this.canvasHandler.registerCanvas('map', mainRef);

        this.render();
    };

    deinit = () => {
        this.canvasHandler.unregisterCanvas('map');
    };

    zoomLevel = 3;
    setZoomLevel = (value: number) => {
        this.zoomLevel = Math.min(ZOOM_CONFIG.length, Math.max(0, value));
        this.render();
    };

    editMode = true;
    setEditMode = (value: boolean) => {
        this.editMode = value;
        this.render();
    };

    render = () => {};

    get zoom() {
        return ZOOM_CONFIG[this.zoomLevel];
    }
}
