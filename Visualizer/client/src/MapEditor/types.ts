import type { TPoint } from '@story/shared';
import type { TMapFile, TMapTileDto } from '@story/visualizer-protocol';

type TColorId = string;

/** The map document the editor works on: `map.json` without its `version` (protocol `TMapFile`). */
export type TMapDocument = TMapFile;
export type TMapTile = TMapTileDto;

/** A tile address: row `i` (`0 … height-1`), column `j` (`0 … width-1`), as in `data[i][j]`. */
export type TTile = { i: number; j: number };

/** What the tile tooling does on a left click / drag: paint with the palette or select a tile to edit its texts. */
export type TTileTool = 'paint' | 'select';

/**
 * @deprecated The pre-WP4 map shape, still used by the legacy `stores/Agent.ts` adapter
 * (`getMap`/`saveMap`, no callers left). New code uses `TMapDocument`.
 */
export type TMapData = {
    mapId: string;
    title: string;
    width: number;
    height: number;
    data: { tile: TColorId; label?: string }[][];
    locations: { i: number; j: number; locationId: string }[];
    maps: { i: number; j: number; mapId: string }[];
    palette: Record<TColorId, { name: string; color: string }>;
};

/** Pointer state of the tile canvas. */
export type TMouseData = {
    /** Canvas-relative CSS px. */
    pos: TPoint;
    /** Tile under the pointer, or null when the pointer is off the map / canvas. */
    tile: TTile | null;
    pointingTo: 'minimap' | 'map';
    hold: 'paint' | 'minimap' | 'pan' | null;
};
