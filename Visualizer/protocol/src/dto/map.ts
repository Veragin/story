import type { TPoint } from '@story/shared';
import type { TVersioned, TVersionedBody } from './common';

export const GLOBAL_MAP_ID = 'global';

export type TColorId = string;

export type TMapTileDto = {
    tile: TColorId;
    label?: string;
    description?: string;
};

export type TPaletteEntryDto = { name: string; color: string };

/** Points are in map world coordinates (the hex renderer at zoom 1), shared by both canvases. */
export type TLocationShapeDto = {
    polygon: TPoint[];
    /** CSS colour; the page picks a default when absent. */
    fill?: string;
    stroke?: string;
};

/** Kept in the data, not shown in the UI. */
export type TSubMapRefDto = { i: number; j: number; mapId: string };

/** `data[i][j]` is row `i`, column `j`. */
export type TMapDto = TVersioned & {
    mapId: string;
    title: string;
    width: number;
    height: number;
    data: TMapTileDto[][];
    palette: Record<TColorId, TPaletteEntryDto>;
    /** Keyed by location id. */
    locations: Record<string, TLocationShapeDto>;
    maps: TSubMapRefDto[];
};

/** The API shape; `map.json` stores it compactly encoded. */
export type TMapFile = Omit<TMapDto, 'version'>;

/** Whole-document replace; `version: ''` creates the file. */
export type TUpdateMapBody = TVersionedBody & TMapFile;
