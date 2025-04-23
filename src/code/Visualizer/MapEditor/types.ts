type TColorId = string;

export type TMapData = {
    mapId: string;
    title: string;
    width: number;
    height: number;
    data: { tile: TColorId; label?: string }[][];
    locations: { i: number; j: number; locationId: string }[];
    maps: { i: number; j: number; mapId: string }[];
    palette: Record<
        TColorId,
        {
            name: string;
            color: string;
        }
    >;
};

export type TMouseData = {
    pos: TPoint;
    size: number;
    poinTo: { i: number; j: number };
    pointingTo: 'minimap' | 'map';
    hold: boolean;
};
