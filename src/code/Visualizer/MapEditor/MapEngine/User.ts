import { TMapData } from '../types';
import { MAP_BORDER } from './constants';
import { computeTilePos } from './utils';

export class User {
    zoom = 1;
    pos = { x: 0, y: 0, spdX: 0, spdY: 0 };
    spdMax = 15;
    mouse = {
        pos: { x: 0, y: 0 },
        size: 3,
        poinTo: { i: 0, j: 0 },
        pointingTo: 0,
        hold: false,
    };
    key = {
        right: false,
        left: false,
        up: false,
        down: false,
        shift: false,
        ctrl: false,
    };
    bounds = {
        left: 0,
        up: 0,
        right: 0,
        down: 0,
    };
    activeColor = 'none';

    updateSpd = () => {
        if (this.key.right && this.key.left) this.pos.spdX = 0;
        else if (this.key.right) this.pos.spdX = this.spdMax;
        else if (this.key.left) this.pos.spdX = -this.spdMax;
        else this.pos.spdX = 0;

        if (this.key.up && this.key.down) this.pos.spdY = 0;
        else if (this.key.down) this.pos.spdY = this.spdMax;
        else if (this.key.up) this.pos.spdY = -this.spdMax;
        else this.pos.spdY = 0;
    };

    update = () => {
        this.updateSpd();
        this.move(this.pos.x + this.pos.spdX, this.pos.y + this.pos.spdY);
    };

    move = (posX: number, posY: number) => {
        if (posX < this.bounds.left * this.zoom) posX = this.bounds.left * this.zoom;
        if (posY < this.bounds.up * this.zoom) posY = this.bounds.up * this.zoom;
        if (posX > this.bounds.right * this.zoom) posX = this.bounds.right * this.zoom;
        if (posY > this.bounds.down * this.zoom) posY = this.bounds.down * this.zoom;
        this.pos.x = posX;
        this.pos.y = posY;
    };

    updateBounds = (map: TMapData) => {
        this.bounds.left = -MAP_BORDER;
        this.bounds.up = -MAP_BORDER;
        const { x, y } = computeTilePos(map.width, map.height);
        this.bounds.right = x + MAP_BORDER;
        this.bounds.down = y + MAP_BORDER;
    };
}
