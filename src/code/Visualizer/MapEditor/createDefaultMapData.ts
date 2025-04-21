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
        name: _('None'),
        color: '#000000',
    },
    grass: {
        name: _('Grass'),
        color: '#D3E671',
    },
    water: {
        name: _('Water'),
        color: '#9EC6F3',
    },
    sand: {
        name: _('Sand'),
        color: '#F0F1C5',
    },
    forest: {
        name: _('Forest'),
        color: '#89AC46',
    },
    mountain: {
        name: _('Mountain'),
        color: '#B7B7B7',
    },
    snow: {
        name: _('Snow'),
        color: '#eee',
    },
    lava: {
        name: _('Lava'),
        color: '#E16A54',
    },
    city: {
        name: _('City'),
        color: '#9F5255',
    },
    road: {
        name: _('Road'),
        color: '#BF9264',
    },
};
