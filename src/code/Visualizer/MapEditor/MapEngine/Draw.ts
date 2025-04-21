import { assertNotNullish } from 'code/utils/typeguards';
import { MapStore } from '../MapStore';
import { HEX_POINTS, MAP_TILE_AVG_HEIGHT, MAP_TILE_WIDTH, WIDGET_BORDER_COLOR, WIDGET_BORDER_WIDTH } from './constants';
import { computeTileIndex, computeTilePos, findNeighbor, minimapSize } from './utils';

export class Draw {
    private ctx: CanvasRenderingContext2D;

    constructor(
        private mapStore: MapStore,
        public canvas: HTMLCanvasElement
    ) {
        const ctx = canvas.getContext('2d');
        assertNotNullish(ctx, 'CanvasRenderingContext2D not supported');
        this.ctx = ctx;
        this.run();
    }

    private get user() {
        return this.mapStore.user;
    }

    private get map() {
        return this.mapStore.data;
    }

    shouldRender = false;
    render = () => {
        this.shouldRender = true;
    };

    private run = () => {
        if (this.shouldRender) {
            this.doRender();
            this.shouldRender = false;
        }
        requestAnimationFrame(this.run);
    };

    private doRender = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(-this.user.pos.x, -this.user.pos.y);
        this.ctx.scale(this.user.zoom, this.user.zoom);

        let d = this.findStartEndPos(this.user.pos.x, this.user.pos.y, this.canvas.width, this.canvas.height);
        this.ctx.lineWidth = 3;
        for (let i = d.startI; i <= d.iTo; i++) {
            for (let j = d.startJ; j <= d.jTo; j++) {
                this.drawTile(i, j);
            }
        }
        if (this.user.mouse.pointingTo == 0) {
            const pack = findNeighbor(
                this.user.mouse.poinTo.i,
                this.user.mouse.poinTo.j,
                this.user.mouse.size,
                this.map.height,
                this.map.width
            );
            for (let k in pack) {
                this.drawTileBorder(pack[k].i, pack[k].j);
            }
        }
        this.ctx.restore();

        if (this.mapStore.showMinimap) {
            this.renderMinimap();
        }
    };

    renderMinimap = () => {
        this.ctx.fillStyle = '#000';
        const size = minimapSize(this.canvas, this.map);
        this.ctx.clearRect(0, this.canvas.height - size.height, size.width, size.height);

        const distanceBetweenTilesJ = size.width / this.map.width;
        const distanceBetweenTilesI = size.height / this.map.height;
        for (let i = 0; i < this.map.height; i++) {
            for (let j = 0; j < this.map.width; j++) {
                const tile = this.map.data[i]?.[j]?.tile;
                if (tile === 'none' || tile === undefined) {
                    continue;
                }
                const color = this.map.palette[tile].color ?? '#000000';
                this.ctx.fillStyle = color;
                this.ctx.fillRect(
                    j * distanceBetweenTilesJ,
                    this.canvas.height - size.height + i * distanceBetweenTilesI,
                    size.width / this.map.width + 1,
                    size.height / this.map.height + 1
                );
            }
        }

        // window
        const { x: mapSizeX, y: mapSizeY } = computeTilePos(this.map.height, this.map.width);
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#FFDE04';
        this.ctx.lineWidth = 1;
        this.ctx.rect(
            ((this.user.pos.x / this.user.zoom) * size.width) / mapSizeX,
            this.canvas.height - size.height + ((this.user.pos.y / this.user.zoom) * size.width) / mapSizeY,
            ((this.canvas.width / this.user.zoom) * size.width) / mapSizeX,
            ((this.canvas.height / this.user.zoom) * size.height) / mapSizeY
        );
        this.ctx.stroke();

        // border
        this.ctx.beginPath();
        this.ctx.lineWidth = WIDGET_BORDER_WIDTH;
        this.ctx.strokeStyle = WIDGET_BORDER_COLOR;
        this.ctx.roundRect(1, this.canvas.height - size.height, size.width, size.height - 1, 6);
        this.ctx.stroke();
    };

    private drawTile = (i: number, j: number) => {
        const tile = this.map.data[i][j].tile;
        if (tile === 'none') return;
        const color = this.map.palette[tile].color ?? '#000000';
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = color;

        this.prepareTilePath(i, j);
        this.ctx.fill();
        this.ctx.stroke();
    };

    private drawTileBorder = (i: number, j: number) => {
        this.ctx.strokeStyle = '#FF0000';
        this.prepareTilePath(i, j);
        this.ctx.stroke();
    };

    private prepareTilePath = (i: number, j: number) => {
        const { x, y } = computeTilePos(i, j);
        this.ctx.beginPath();
        this.ctx.moveTo(x + HEX_POINTS[0].x, y + HEX_POINTS[0].y);
        for (let i = 1; i < HEX_POINTS.length; i++) {
            this.ctx.lineTo(x + HEX_POINTS[i].x, y + HEX_POINTS[i].y);
        }
        this.ctx.closePath();
    };

    private findStartEndPos = (x: number, y: number, width: number, height: number) => {
        const pack: TPack = {
            startI: 0,
            startJ: 0,
            iTo: 0,
            jTo: 0,
        };
        const { i, j } = computeTileIndex(x / this.user.zoom, y / this.user.zoom);
        pack.startI = Math.min(Math.max(0, i - 1), this.map.height - 1);
        pack.startJ = Math.min(Math.max(0, j - 1), this.map.width - 1);

        pack.iTo = pack.startI + Math.ceil(height / MAP_TILE_AVG_HEIGHT / this.user.zoom) + 2;
        pack.jTo = pack.startJ + Math.ceil(width / MAP_TILE_WIDTH / this.user.zoom) + 2;
        pack.iTo = Math.min(Math.max(0, pack.iTo), this.map.height - 1);
        pack.jTo = Math.min(Math.max(0, pack.jTo), this.map.width - 1);

        return pack;
    };
}

type TPack = {
    startI: number;
    startJ: number;
    iTo: number;
    jTo: number;
};
