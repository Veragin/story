export type TPoint = { x: number; y: number };

export type TSize = { width: number; height: number };

export type TRect = { x: number; y: number; width: number; height: number };

export type TStroke = {
    color: string;
    width: number;
    dash?: number[];
    // `width` and `dash` in screen pixels, unaffected by zoom
    screenWidth?: boolean;
};
