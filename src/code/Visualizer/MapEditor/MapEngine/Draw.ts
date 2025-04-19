import { assertNotNullish } from 'code/utils/typeguards';
import { MapStore } from '../MapStore';
import { HEX_POINTS, MAP_TILE_HEIGHT, MAP_TILE_WIDTH } from './constants';
import { computeRealPos } from './utils';

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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
    /*
    renderMinimap = () => {
        if(map.minimapMinimal)
            return;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, HEIGHT - MINIMAP_HEIGHT, MINIMAP_WIDTH, MINIMAP_HEIGHT);
        var distanceBetweenTiles = MINIMAP_WIDTH/map.width;
        var mapSizeX = map.data[0][map.width-1].x;
        var mapSizeY = map.data[map.height-1][0].y;
        for(var i = 0; i < map.height; i++){
            for(var j = 0; j < map.width; j++){
                if(map.data[i][j].map === 'none'){
                    continue;
                }
                ctx.fillStyle = palete.MAP_TILES_COLOR[map.data[i][j].map];
                ctx.fillRect(j*distanceBetweenTiles, HEIGHT - MINIMAP_HEIGHT + i * distanceBetweenTiles, MINIMAP_WIDTH / map.width +1, MINIMAP_HEIGHT / map.height+ 1);
            }
        }
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#FFDE04";
        this.ctx.lineWidth=1;
        this.ctx.rect((user.pos.x-WHAT_PLAYER_CAN_SEE_WIDTH/2)*MINIMAP_WIDTH/mapSizeX, HEIGHT - MINIMAP_HEIGHT + (user.pos.y-WHAT_PLAYER_CAN_SEE_HEIGHT/2)*MINIMAP_WIDTH/mapSizeY, WHAT_PLAYER_CAN_SEE_WIDTH*MINIMAP_WIDTH/mapSizeX, WHAT_PLAYER_CAN_SEE_HEIGHT*MINIMAP_HEIGHT/mapSizeY);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.lineWidth=4;
        this.ctx.strokeStyle = "#C6A288";
        this.ctx.rect(0, HEIGHT - MINIMAP_HEIGHT, MINIMAP_WIDTH, MINIMAP_HEIGHT);
        this.ctx.stroke();
    }*/

    private drawTile = (i: number, j: number) => {
        const tile = this.map.data[i][j].tile;
        if (tile === 'none') return;
        this.ctx.fillStyle = this.map.palette[tile].color ?? '#000000';

        this.prepareTilePath(i, j);
        this.ctx.fill();
    };

    private drawTileBorder = (i: number, j: number) => {
        this.ctx.strokeStyle = '#FF0000';
        this.prepareTilePath(i, j);
        this.ctx.stroke();
    };

    private prepareTilePath = (i: number, j: number) => {
        const { x, y } = this.getTilePos(i, j);
        this.ctx.beginPath();
        this.ctx.moveTo(x + HEX_POINTS[0].x * this.user.zoom, y + HEX_POINTS[0].y * this.user.zoom);
        for (let i = 1; i < HEX_POINTS.length; i++) {
            this.ctx.lineTo(x + HEX_POINTS[i].x * this.user.zoom, y + HEX_POINTS[i].y * this.user.zoom);
        }
        this.ctx.closePath();
    };

    private getTilePos = (i: number, j: number) => {
        const { realX, realY } = computeRealPos(i, j, this.user.zoom);
        const x = realX - this.user.pos.x;
        const y = realY - this.user.pos.y;
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
