import { TMapData } from '../types';
import { computeRealPos, MAP_TILE_HEIGHT, MAP_TILE_WIDTH, MINIMAP_RATIO } from './constants';
import { Draw } from './Draw';
import { User } from './User';

export class Process {
    constructor(
        private user: User,
        draw: Draw
    ) {
        setInterval(function () {
            user.update();
            draw.render();
        }, 40);
    }

    minimapMove = (map: TMapData, canvas: HTMLCanvasElement) => {
        const { realX, realY } = computeRealPos(map.width, map.height, this.user.zoom);
        const minimapWidth = canvas.width * MINIMAP_RATIO;
        const minimapHeight = canvas.height * MINIMAP_RATIO;
        this.user.move(
            ((this.user.mouse.pos.x + canvas.width / 2) * realX) / minimapWidth,
            ((this.user.mouse.pos.y - canvas.height / 2 + minimapHeight) * realY) / minimapHeight
        );
    };

    findSelectedTile = () => {
        this.user.mouse.poinTo.i = Math.floor(
            (this.user.mouse.pos.y + this.user.pos.y) / (MAP_TILE_HEIGHT * this.user.zoom)
        );
        this.user.mouse.poinTo.j = Math.floor(
            (this.user.mouse.pos.x + this.user.pos.x) / (MAP_TILE_WIDTH * this.user.zoom) +
                0.5 * (this.user.mouse.poinTo.i % 2)
        );
    };

    fillColorToPointing = (map: TMapData) => {
        map.data[this.user.mouse.poinTo.i][this.user.mouse.poinTo.j].tile = this.user.activeColor;
    };
}
