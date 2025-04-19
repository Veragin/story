import { HEX_RADIUS, MAP_TILE_HEIGHT, MAP_TILE_WIDTH, MINIMAP_RATIO } from './constants';

export const computeRealPos = (i: number, j: number, zoom: number) => {
    const isOdd = i % 2;
    const realX = (j * MAP_TILE_WIDTH + MAP_TILE_WIDTH / 2 + (isOdd * MAP_TILE_WIDTH) / 2) * zoom;
    const realY = (i / 2) * (MAP_TILE_HEIGHT + HEX_RADIUS) * zoom;
    return { realX, realY };
};

export const computeTileInedx = (x: number, y: number, zoom: number) => {
    const i = Math.round((y / zoom / (MAP_TILE_HEIGHT + HEX_RADIUS)) * 2);
    const j = Math.round((x / zoom - MAP_TILE_WIDTH / 2 + ((i % 2) * MAP_TILE_WIDTH) / 2) / MAP_TILE_WIDTH);
    return { i, j };
};

export const minimapSize = (canvas: HTMLCanvasElement) => {
    return {
        width: canvas.width * MINIMAP_RATIO,
        height: canvas.height * MINIMAP_RATIO,
    };
};
