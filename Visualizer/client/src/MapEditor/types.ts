import type { TPoint } from '@story/shared';
import type { TMapFile, TMapTileDto } from '@story/visualizer-protocol';

/** The map document the editor works on: `map.json` without its `version` (protocol `TMapFile`). */
export type TMapDocument = TMapFile;
export type TMapTile = TMapTileDto;

/** A tile address: row `i` (`0 … height-1`), column `j` (`0 … width-1`), as in `data[i][j]`. */
export type TTile = { i: number; j: number };

/** What the tile tooling does on a left click / drag: paint with the palette or select a tile to edit its texts. */
export type TTileTool = 'paint' | 'select';

/** Pointer state of the tile canvas. */
export type TMouseData = {
    /** Canvas-relative CSS px. */
    pos: TPoint;
    /** Tile under the pointer, or null when the pointer is off the map / canvas. */
    tile: TTile | null;
    pointingTo: 'minimap' | 'map';
    hold: 'paint' | 'minimap' | 'pan' | null;
};
