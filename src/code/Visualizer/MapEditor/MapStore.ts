import { action, makeObservable, observable } from 'mobx';
import { CanvasHandler } from '../stores/CanvasHandler';
import { TMapData, TMode, TTile } from './types';
import { User } from './MapEngine/User';
import { Draw } from './MapEngine/Draw';
import { Process } from './MapEngine/Process';
import { MAX_ZOOM } from './MapEngine/constants';
import { MouseListener } from './MapEngine/MouseListener';

export class MapStore {
    user = new User();
    draw: Draw | null = null;
    process: Process | null = null;
    mouseListener: MouseListener;
    editMode: boolean = false;

    constructor(
        private canvasHandler: CanvasHandler,
        public data: TMapData
    ) {
        this.mouseListener = new MouseListener(this);
        makeObservable(this, {
            mode: observable,
            setMode: action,
            zoomLevel: observable,
            setZoomLevel: action,
            openNewMapModal: observable,
            setOpenNewMapModal: action,
            showMinimap: observable,
            toggleShowMinimap: action,
            selectedColorId: observable,
            setSelectedColorId: action,
            selectedTile: observable,
            setSelectedTile: action,
        });
    }

    init = (canvas: HTMLCanvasElement, infoRef: HTMLDivElement) => {
        this.deinit();

        this.canvasHandler.registerCanvas('map', canvas);
        this.user.updateBounds(this.data, canvas);
        this.draw = new Draw(this, canvas);
        this.process = new Process(this, infoRef);
        this.mouseListener.init(canvas);

        this.render();
    };

    setEditMode = (editMode: boolean) => {
        this.editMode = editMode;
    }

    deinit = () => {
        this.canvasHandler.unregisterCanvas('map');
        this.mouseListener.deinit();
    };

    zoomLevel = 3;
    setZoomLevel = (value: number) => {
        this.zoomLevel = Math.min(MAX_ZOOM, Math.max(0, value));
        this.user.zoom = 0.6 + value * 0.2;
        if (this.draw) {
            this.user.updateBounds(this.data, this.draw.canvas);
        }
        this.render();
    };

    mode: TMode = 'palette';
    setMode = (mode: TMode) => {
        this.mode = mode;
        this.render();
    };

    render = () => {
        this.draw?.render();
    };

    openNewMapModal: string | null = null;
    setOpenNewMapModal = (mapId: string | null) => {
        this.openNewMapModal = mapId;
    };

    showMinimap = true;
    toggleShowMinimap = () => {
        this.showMinimap = !this.showMinimap;
        this.render();
    };

    selectedColorId = 'none';
    setSelectedColorId = (colorId: string) => {
        this.selectedColorId = colorId;
    };

    selectedTile: TTile | null = null;
    setSelectedTile = (tile: TTile | null) => {
        this.selectedTile = tile;
    };

    deleteColor = () => {
        const colorId = this.selectedColorId;
        if (colorId === 'none') {
            return;
        }
        delete this.data.palette[colorId];
        for (const row of this.data.data) {
            for (const tile of row) {
                if (tile.tile === colorId) {
                    tile.tile = 'none';
                }
            }
        }
        this.setSelectedColorId('none');
        this.render();
    };
}
