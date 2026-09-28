import type { TMapDocument } from './types';

export const DEFAULT_MAP_WIDTH = 80;
export const DEFAULT_MAP_HEIGHT = 60;

/**
 * An empty map of `width` columns × `height` rows. `data[i][j]` is row `i`, column `j`, the
 * indexing the renderer uses (this used to build `width` rows of `height` tiles, i.e. transposed).
 */
export const createDefaultMapData = (
    id: string,
    name: string,
    width: number = DEFAULT_MAP_WIDTH,
    height: number = DEFAULT_MAP_HEIGHT
): TMapDocument => {
    const data: TMapDocument['data'] = [];
    for (let i = 0; i < height; i++) {
        const row: TMapDocument['data'][number] = [];
        for (let j = 0; j < width; j++) {
            row.push({ tile: 'none' });
        }
        data.push(row);
    }
    return {
        mapId: id,
        title: name,
        width,
        height,
        data,
        locations: {},
        maps: [],
        palette: structuredClone(DEFAULT_PALETTE),
    };
};

export const DEFAULT_PALETTE: TMapDocument['palette'] = {
    none: { name: 'None', color: '#000000' },
    grass: { name: 'Grass', color: '#D3E671' },
    water: { name: 'Water', color: '#9EC6F3' },
    sand: { name: 'Sand', color: '#F0F1C5' },
    forest: { name: 'Forest', color: '#89AC46' },
    mountain: { name: 'Mountain', color: '#B7B7B7' },
    snow: { name: 'Snow', color: '#eeeeee' },
    lava: { name: 'Lava', color: '#E16A54' },
    city: { name: 'City', color: '#9F5255' },
    road: { name: 'Road', color: '#BF9264' },
};
