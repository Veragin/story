import { MapStore } from '../MapStore';
import { computeTilePos, computeTileIndex, minimapSize, findNeighbor } from './utils';
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
        if (this.user.pos.spdX === 0 && this.user.pos.spdY === 0) {
            return;
        }
        this.user.moveBySpeed();
        this.findSelectedTile();
        if (this.user.mouse.hold) {
            this.fillColorToPointing();
        }
        this.mapStore.render();
    };

    minimapMove = (canvas: HTMLCanvasElement) => {
        const { x, y } = computeTilePos(this.map.width, this.map.height);
        const minimap = minimapSize(canvas, this.map);
        this.user.move(
            (this.user.mouse.pos.x / minimap.width) * x * this.user.zoom - canvas.width / 2,
            ((this.user.mouse.pos.y - canvas.height + minimap.height) / minimap.height) * y * this.user.zoom -
                canvas.height / 2
        );
        this.mapStore.render();
    };

    findSelectedTile = () => {
        this.user.mouse.poinTo = computeTileIndex(
            (this.user.pos.x + this.user.mouse.pos.x) / this.user.zoom,
            (this.user.pos.y + this.user.mouse.pos.y) / this.user.zoom
        );
    };

    fillColorToPointing = () => {
        const pack = findNeighbor(
            this.user.mouse.poinTo.i,
            this.user.mouse.poinTo.j,
            this.user.mouse.size,
            this.map.height,
            this.map.width
        );
        pack.forEach((tile) => {
            this.map.data[tile.i][tile.j].tile = this.mapStore.selectedColorId;
        });
    };

    displayInfo = () => {
        const { i, j } = this.user.mouse.poinTo;
        this.infoDiv.innerHTML = `
            <span>i: ${i}</span>
            <span>j: ${j}</span>
            <span>tile: ${this.map.data[i]?.[j]?.tile ?? '-'}</span>`;
    };
}
