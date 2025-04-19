import { HEX_RADIUS, MAP_TILE_HEIGHT, MAP_TILE_WIDTH, MINIMAP_RATIO } from './constants';

export const computeTilePos = (i: number, j: number) => {
    const isOdd = i % 2;
    const x = j * MAP_TILE_WIDTH + MAP_TILE_WIDTH / 2 + (isOdd * MAP_TILE_WIDTH) / 2;
    const y = (i / 2) * (MAP_TILE_HEIGHT + HEX_RADIUS);
    return { x, y };
};

export const computeTileIndex = (x: number, y: number) => {
    const i = Math.round((y / (MAP_TILE_HEIGHT + HEX_RADIUS)) * 2);
    const j = Math.round((x - MAP_TILE_WIDTH / 2 - ((i % 2) * MAP_TILE_WIDTH) / 2) / MAP_TILE_WIDTH);
    return { i, j };
};

export const minimapSize = (canvas: HTMLCanvasElement) => {
    return {
        width: canvas.width * MINIMAP_RATIO,
        height: canvas.height * MINIMAP_RATIO,
    };
};
