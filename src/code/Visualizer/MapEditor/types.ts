export type TMapData = {
    mapId: string;
    title: string;
    width: number;
    height: number;
    data: { tile: string; title?: string }[][];
    locations: { i: number; j: number; locationId: string }[];
    maps: { i: number; j: number; mapId: string }[];
    palette: Record<
        string,
        {
            name: string;
            color: string;
        }
    >;
};
