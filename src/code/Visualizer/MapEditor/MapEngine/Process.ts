import { MapStore } from '../MapStore';
import { TMapData } from '../types';
import { computeTilePos, computeTileIndex, minimapSize } from './utils';
export class Process {
    constructor(
        private mapStore: MapStore,
        private infoDiv: HTMLDivElement
    ) {
        setInterval(() => {
            this.update();
        }, 40);
    }

    private get user() {
        return this.mapStore.user;
    }

    private get map() {
        return this.mapStore.data;
    }

    update = () => {
        this.user.updateSpd();
        if (this.user.pos.spdX === 0 || this.user.pos.spdY === 0) {
            return;
        }
        this.user.moveBySpeed();
        this.mapStore.render();
    };

    minimapMove = (map: TMapData, canvas: HTMLCanvasElement) => {
        const { x, y } = computeTilePos(map.width, map.height);
        const minimap = minimapSize(canvas);
        this.user.move(
            ((this.user.mouse.pos.x + canvas.width / 2) * x) / minimap.width,
            ((this.user.mouse.pos.y - canvas.height / 2 + minimap.height) * y) / minimap.height
        );
        this.mapStore.render();
    };

    findSelectedTile = () => {
        this.user.mouse.poinTo = computeTileIndex(
            this.user.pos.x + this.user.mouse.pos.x / this.user.zoom,
            this.user.pos.y + this.user.mouse.pos.y / this.user.zoom
        );
    };

    fillColorToPointing = (map: TMapData) => {
        map.data[this.user.mouse.poinTo.i][this.user.mouse.poinTo.j].tile = this.user.activeColor;
    };

    displayInfo = () => {
        const { i, j } = this.user.mouse.poinTo;
        this.infoDiv.innerHTML = `i: ${i}, j: ${j}, color: ${this.map.data[i]?.[j]?.tile ?? '-'}`;
    };
}
