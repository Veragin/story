export const ANGLE_BASE = Math.PI / 2;
export const MAP_TILE_WIDTH = 62;
export const MAP_TILE_HEIGHT = 53;
export const MAP_BORDER = 100;

export const HEXAGON_ANGLE = 0.523598776; // 30 degrees in radians
export const SIDE_LENGTH = 36;

export const HEX_HEIGHT = Math.sin(HEXAGON_ANGLE) * SIDE_LENGTH;
export const HEX_RADIUS = Math.cos(HEXAGON_ANGLE) * SIDE_LENGTH;
export const HEX_RECT_HEIGHT = SIDE_LENGTH + 2 * HEX_HEIGHT;
export const HEX_RECT_WIDTH = 2 * HEX_RADIUS;

export const MINIMAP_RATIO = 1 / 8;
export const MAX_ZOOM = 4;

export const computeRealPos = (i: number, j: number, zoom: number) => {
    const realX = (j * MAP_TILE_WIDTH + MAP_TILE_WIDTH / 2 + ((i % 2) * MAP_TILE_WIDTH) / 2) * zoom;
    const realY = (i * MAP_TILE_HEIGHT + MAP_TILE_HEIGHT / 2) * zoom;
    return { realX, realY };
};
