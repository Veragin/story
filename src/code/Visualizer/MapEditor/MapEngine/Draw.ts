import { assertNotNullish } from 'code/utils/typeguards';
import { MapStore } from '../MapStore';
import {
    computeRealPos,
    HEX_HEIGHT,
    HEX_RADIUS,
    HEX_RECT_HEIGHT,
    HEX_RECT_WIDTH,
    MAP_TILE_HEIGHT,
    MAP_TILE_WIDTH,
    SIDE_LENGTH,
} from './constants';

export class Draw {
    private ctx: CanvasRenderingContext2D;

    constructor(
        private mapStore: MapStore,
        private canvas: HTMLCanvasElement
    ) {
        const ctx = canvas.getContext('2d');
        assertNotNullish(ctx, 'CanvasRenderingContext2D not supported');
        this.ctx = ctx;
    }

    private get user() {
        return this.mapStore.user;
    }

    private get map() {
        return this.mapStore.data;
    }

    render = () => {
        let d = this.findStartEndPos(this.user.pos.x, this.user.pos.y, this.canvas.width, this.canvas.height);
        for (let i = d.startI; i <= d.iTo; i++) {
            for (let j = d.startJ; j <= d.jTo; j++) {
                this.drawTile(i, j);
            }
        }
        if (this.user.mouse.pointingTo == 0) {
            const pack = this.findNeighbor(this.user.mouse.poinTo.i, this.user.mouse.poinTo.j, this.user.mouse.size);
            for (let k in pack) {
                this.drawTileBorder(pack[k].i, pack[k].j);
            }
        }
    };

    private drawTile = (i: number, j: number) => {
        const tile = this.map.data[i][j].tile;
        if (tile === 'none') return;
        this.ctx.fillStyle = this.map.palette[tile].color ?? '#000000';

        const { x, y } = this.getTilePos(i, j);
        this.ctx.beginPath();
        this.ctx.moveTo(x + HEX_RADIUS * this.user.zoom, y);
        this.ctx.lineTo(x + HEX_RECT_WIDTH * this.user.zoom, y + HEX_HEIGHT * this.user.zoom);
        this.ctx.lineTo(x + HEX_RECT_WIDTH * this.user.zoom, y + (HEX_HEIGHT + SIDE_LENGTH) * this.user.zoom);
        this.ctx.lineTo(x + HEX_RADIUS * this.user.zoom, y + HEX_RECT_HEIGHT * this.user.zoom);
        this.ctx.lineTo(x, y + (SIDE_LENGTH + HEX_HEIGHT) * this.user.zoom);
        this.ctx.lineTo(x, y + HEX_HEIGHT * this.user.zoom);
        this.ctx.closePath();
        this.ctx.fill();
    };

    private drawTileBorder = (i: number, j: number) => {
        this.ctx.strokeStyle = '#FF0000';
        const { x, y } = this.getTilePos(i, j);
        this.ctx.beginPath();
        this.ctx.moveTo(x + HEX_RADIUS * this.user.zoom, y);
        this.ctx.lineTo(x + HEX_RECT_WIDTH * this.user.zoom, y + HEX_HEIGHT * this.user.zoom);
        this.ctx.lineTo(x + HEX_RECT_WIDTH * this.user.zoom, y + (HEX_HEIGHT + SIDE_LENGTH) * this.user.zoom);
        this.ctx.lineTo(x + HEX_RADIUS * this.user.zoom, y + HEX_RECT_HEIGHT * this.user.zoom);
        this.ctx.lineTo(x, y + (SIDE_LENGTH + HEX_HEIGHT) * this.user.zoom);
        this.ctx.lineTo(x, y + HEX_HEIGHT * this.user.zoom);
        this.ctx.closePath();
        this.ctx.stroke();
    };

    private getTilePos = (i: number, j: number) => {
        const { realX, realY } = computeRealPos(i, j, this.user.zoom);
        const x = realX - this.user.pos.x + this.canvas.width / 2 - HEX_RECT_WIDTH / 2;
        const y = realY - this.user.pos.y + this.canvas.height / 2 - HEX_RECT_HEIGHT / 2;
        return { x, y };
    };

    private findStartEndPos = (x: number, y: number, width: number, height: number) => {
        const pack: TPack = {
            startI: 0,
            startJ: 0,
            iTo: 0,
            jTo: 0,
        };
        pack.startI = Math.floor((y - height / 2) / (MAP_TILE_HEIGHT * this.user.zoom)) - 1;
        pack.startJ = Math.floor((x - width / 2) / (MAP_TILE_WIDTH * this.user.zoom)) - 1;
        pack.iTo = pack.startI + Math.ceil(height / (MAP_TILE_HEIGHT * this.user.zoom)) + 5;
        pack.jTo = pack.startJ + Math.ceil(width / (MAP_TILE_WIDTH * this.user.zoom)) + 5;

        if (pack.startI >= this.map.height) {
            pack.startI = this.map.height - 1;
            pack.iTo = this.map.height - 1;
        } else if (pack.iTo >= this.map.height) pack.iTo = this.map.height - 1;
        if (pack.startJ >= this.map.width) {
            pack.startJ = this.map.width - 1;
            pack.jTo = this.map.width - 1;
        } else if (pack.jTo >= this.map.width) pack.jTo = this.map.width - 1;

        if (pack.iTo < 0) {
            pack.startI = 0;
            pack.iTo = 0;
        }
        if (pack.startI < 0) pack.startI = 0;
        if (pack.jTo < 0) {
            pack.startJ = 0;
            pack.jTo = 0;
        }
        if (pack.startJ < 0) pack.startJ = 0;

        return pack;
    };

    private findNeighbor = (si: number, sj: number, size: number) => {
        const pack = [];
        for (let j = sj - size + 1 - (si % 2); j < sj + size - (si % 2); j++) {
            if (si >= 0 && j >= 0 && si < this.map.height && j < this.map.width) pack.push({ i: si, j: j });
        }
        for (let i = 1; i < size; i++) {
            for (
                let j =
                    sj - size + 1 - (si % 2) + (i % 2) * (2 * (si % 2) - 1) + (i - (si % 2) + ((i - (si % 2)) % 2)) / 2;
                j < sj + size - (si % 2) - (i - (si % 2) + ((i - (si % 2)) % 2)) / 2;
                j++
            ) {
                if (si + i >= 0 && j >= 0 && si + i < this.map.height && j < this.map.width)
                    pack.push({ i: si + i, j: j });
                if (si - i >= 0 && j >= 0 && si - i < this.map.height && j < this.map.width)
                    pack.push({ i: si - i, j: j });
            }
        }
        return pack;
    };
}

type TPack = {
    startI: number;
    startJ: number;
    iTo: number;
    jTo: number;
};
