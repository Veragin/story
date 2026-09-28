/** A point (or vector) in either world or screen space; which one is always named by the API. */
export type TPoint = { x: number; y: number };

export type TSize = { width: number; height: number };

/** Axis-aligned rectangle. `x`/`y` is the top-left corner. */
export type TRect = { x: number; y: number; width: number; height: number };

export type TStroke = {
    color: string;
    /** Line width in world units, unless `screenWidth` is set. */
    width: number;
    /** Canvas `setLineDash` segments, in the same units as `width`. */
    dash?: number[];
    /** When true, `width` and `dash` are in screen pixels and do not scale with the zoom. */
    screenWidth?: boolean;
};
