import { TLocation } from '@story/types';

import { applyFormatting } from '@story/shared';
void applyFormatting;

export const kingdomLocation: TLocation<'kingdom'> = {
    id: 'kingdom',
    name: _('kingdom'),
    description: ``,

    localCharacters: [],

    shape: {
        mapId: 'global',
        points: [
            { x: 1060, y: 260 },
            { x: 1560, y: 300 },
            { x: 1640, y: 640 },
            { x: 1320, y: 820 },
            { x: 1040, y: 640 },
        ],
        color: '#c9a227',
        z: 1,
    },

    init: {},
};

export type TKingdomLocationData = {};
