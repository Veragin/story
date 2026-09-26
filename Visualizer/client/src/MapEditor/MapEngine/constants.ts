export const HEX_RADIUS = 36;
const HEX_ANGLE = (2 * Math.PI) / 6;

/** Pointy-top hexagon around (0, 0), in world units. */
export const HEX_POINTS = [0, 1, 2, 3, 4, 5].map((i) => ({
    x: HEX_RADIUS * Math.sin(HEX_ANGLE * i),
    y: HEX_RADIUS * Math.cos(HEX_ANGLE * i),
}));

export const MAP_TILE_WIDTH = HEX_POINTS[1].x - HEX_POINTS[5].x;
export const MAP_TILE_HEIGHT = HEX_POINTS[0].y - HEX_POINTS[3].y;
/** Vertical distance between two rows of tile centres. */
export const MAP_TILE_AVG_HEIGHT = (MAP_TILE_HEIGHT + HEX_RADIUS) / 2;

/** How far (world units) the camera may go past the map edge. */
export const MAP_BORDER = 240;
export const MINIMAP_RATIO = 1 / 6;
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 6;

/** Tile labels are drawn from this zoom on, descriptions from the next one. */
export const LABEL_MIN_ZOOM = 0.7;
export const DESCRIPTION_MIN_ZOOM = 1.6;
export const LABEL_FONT_SIZE = 11;
export const DESCRIPTION_FONT_SIZE = 6;
export const DESCRIPTION_MAX_LINES = 4;

export const MAX_BRUSH_SIZE = 12;

/** Drawn for `none` tiles so an empty map is still visible on the black page. */
export const EMPTY_TILE_FILL = '#101010';
export const EMPTY_TILE_STROKE = '#262626';

export const WIDGET_BORDER_COLOR = '#c6a288';
export const WIDGET_BORDER_WIDTH = 3;
