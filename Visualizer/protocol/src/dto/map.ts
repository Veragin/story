import type { TPoint } from '@story/shared';
import type { TVersioned, TVersionedBody } from './common';

/** Only one map exists for now (plan §1.1), stored in `data/locations/map.json`. */
export const GLOBAL_MAP_ID = 'global';

/** A palette colour id (`'grass'`, `'water'`, `'none'`, …). */
export type TColorId = string;

/**
 * One hex tile. `tile` picks the palette colour, `label` is the short text drawn on the tile, and
 * `description` is free text about the environment (plan §1.1 "Tile descriptions") — neither is
 * tied to an entity.
 */
export type TMapTileDto = {
    tile: TColorId;
    label?: string;
    description?: string;
};

export type TPaletteEntryDto = { name: string; color: string };

/**
 * A location's polygon on the map, keyed by `locationId` in `TMapDto.locations` (plan §1).
 * Points are in map world coordinates — the space of the hex renderer at zoom 1
 * (`MapEditor/MapEngine/utils.ts#computeTilePos`) — so both canvases can share one camera.
 */
export type TLocationShapeDto = {
    polygon: TPoint[];
    /** CSS colour; the page picks a default when absent. */
    fill?: string;
    stroke?: string;
};

/** A link to a sub-map anchored on a tile. Kept in the data, not shown in the UI (plan §1.1). */
export type TSubMapRefDto = { i: number; j: number; mapId: string };

/**
 * `map.json`. `data[i][j]` is row `i` (`0 … height-1`), column `j` (`0 … width-1`) — the indexing
 * `MapEngine/Draw.ts` uses. (`createDefaultMapData` builds it transposed; that is one of the WP4
 * bugs, see plan §2.)
 */
export type TMapDto = TVersioned & {
    mapId: string;
    title: string;
    width: number;
    height: number;
    data: TMapTileDto[][];
    palette: Record<TColorId, TPaletteEntryDto>;
    locations: Record<string, TLocationShapeDto>;
    maps: TSubMapRefDto[];
};

/**
 * The map document without `version` (the version is the hash of the file text). On disk,
 * `map.json` stores it in a compact encoding (run-length tile rows, sparse `tileText`); see
 * `Visualizer/server/src/json/mapStore.ts`. The API always speaks this shape.
 */
export type TMapFile = Omit<TMapDto, 'version'>;

/** `PUT /api/maps/:mapId` — a whole-document replace. `version: ''` creates the file. */
export type TUpdateMapBody = TVersionedBody & TMapFile;
