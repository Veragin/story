export const HEX_RADIUS = 36;
const HEX_ANGLE = (2 * Math.PI) / 6;

export const HEX_POINTS = [0, 1, 2, 3, 4, 5].map((i) => ({
    x: HEX_RADIUS * Math.sin(HEX_ANGLE * i),
    y: HEX_RADIUS * Math.cos(HEX_ANGLE * i),
}));

export const MAP_TILE_WIDTH = HEX_POINTS[1].x - HEX_POINTS[5].x;
export const MAP_TILE_HEIGHT = HEX_POINTS[0].y - HEX_POINTS[3].y;
export const MAP_TILE_AVG_HEIGHT = (MAP_TILE_HEIGHT + HEX_RADIUS) / 2;

export const MAP_BORDER = 120;
export const MINIMAP_RATIO = 1 / 6;
export const MAX_ZOOM = 4;

export const WIDGET_BORDER_COLOR = '#c6a288';
export const WIDGET_BORDER_WIDTH = 3;
