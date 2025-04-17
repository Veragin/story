import { action, makeObservable, observable } from 'mobx';
import { CanvasHandler } from '../stores/CanvasHandler';
import { TMapData } from './types';
import { User } from './MapEngine/User';
import { Draw } from './MapEngine/Draw';
import { Process } from './MapEngine/Process';
import { MAX_ZOOM } from './MapEngine/constants';

export class MapStore {
    user = new User();
    draw: Draw | null = null;
    process = new Process(this.user);

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

    init = (canvas: HTMLCanvasElement, infoRef: HTMLDivElement) => {
        this.deinit();

        this.canvasHandler.registerCanvas('map', canvas);
        this.user.updateBounds(this.data, canvas);
        this.draw = new Draw(this, canvas);

        this.render();
    };

    deinit = () => {
        this.canvasHandler.unregisterCanvas('map');
    };

    zoomLevel = 3;
    setZoomLevel = (value: number) => {
        this.zoomLevel = Math.min(MAX_ZOOM, Math.max(0, value));
        this.user.zoom = 0.6 + value * 0.2;
        this.render();
    };

    editMode = true;
    setEditMode = (value: boolean) => {
        this.editMode = value;
        this.render();
    };

    render = () => {
        this.draw?.render();
    };
}
