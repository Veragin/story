import { MapStore } from '../MapStore';
import { TMapData } from '../types';
import { computeRealPos, computeTileInedx, minimapSize } from './utils';
export class Process {
    constructor(
        private mapStore: MapStore,
        private infoDiv: HTMLDivElement
    ) {
        setInterval(() => {
            this.user.update();
            this.mapStore.draw?.render();
        }, 40);
    }

    private get user() {
        return this.mapStore.user;
    }

    private get map() {
        return this.mapStore.data;
    }

    minimapMove = (map: TMapData, canvas: HTMLCanvasElement) => {
        const { realX, realY } = computeRealPos(map.width, map.height, this.user.zoom);
        const minimap = minimapSize(canvas);
        this.user.move(
            ((this.user.mouse.pos.x + canvas.width / 2) * realX) / minimap.width,
            ((this.user.mouse.pos.y - canvas.height / 2 + minimap.height) * realY) / minimap.height
        );
    };

    findSelectedTile = () => {
        const { i, j } = computeTileInedx(
            this.user.mouse.pos.x + this.user.pos.x,
            this.user.mouse.pos.y + this.user.pos.y,
            this.user.zoom
        );
        this.user.mouse.poinTo.i = i;
        this.user.mouse.poinTo.j = j;
    };

    fillColorToPointing = (map: TMapData) => {
        map.data[this.user.mouse.poinTo.i][this.user.mouse.poinTo.j].tile = this.user.activeColor;
    };

    displayInfo = () => {
        const { i, j } = this.user.mouse.poinTo;
        this.infoDiv.innerHTML = `i: ${i}, j: ${j}, color: ${this.map.data[i][j].tile}`;
    };
}
