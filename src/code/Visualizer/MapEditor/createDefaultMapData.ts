import { TMapData } from './types';

export const createDefaultMapData = (id: string, name: string, w: number, h: number) => {
    const data: TMapData['data'] = [];
    for (let i = 0; i < w; i++) {
        const row = [];
        for (let j = 0; j < h; j++) {
            row.push({
                tile: 'none',
            });
        }
        data.push(row);
    }
    return {
        mapId: id,
        title: name,
        width: w,
        height: h,
        data,
        locations: [],
        maps: [],
        palette: DEFAULT_PALETTE,
    };
};

export const DEFAULT_PALETTE: TMapData['palette'] = {
    none: {
        name: 'None',
        color: '#000000',
    },
    grass: {
        name: 'Grass',
        color: '#00FF00',
    },
    water: {
        name: 'Water',
        color: '#0000FF',
    },
    sand: {
        name: 'Sand',
        color: '#FFFF00',
    },
    rock: {
        name: 'Rock',
        color: '#808080',
    },
    forest: {
        name: 'Forest',
        color: '#228B22',
    },
    mountain: {
        name: 'Mountain',
        color: '#A9A9A9',
    },
    snow: {
        name: 'Snow',
        color: '#FFFFFF',
    },
    lava: {
        name: 'Lava',
        color: '#FF4500',
    },
    city: {
        name: 'City',
        color: '#FF69B4',
    },
    road: {
        name: 'Road',
        color: '#A52A2A',
    },
};
