import type { TMapFile, TMapTileDto } from '@story/visualizer-protocol';

export type TMapDocument = TMapFile;
export type TMapTile = TMapTileDto;

export type TTile = { i: number; j: number };

export type TTileTool = 'paint' | 'select';
