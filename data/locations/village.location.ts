import { TLocation } from '@story/types';

export const villageLocation: TLocation<'village'> = {
    id: 'village',
    name: 'Village',
    description: 'The village is a small place, with a few houses and a tavern.',

    localCharacters: [
        {
            name: 'Pepa',
            description: 'Pepa is a very smart',
        },
    ],

    shape: {
        mapId: 'global',
        points: [
            { x: 380, y: 420 },
            { x: 760, y: 380 },
            { x: 880, y: 620 },
            { x: 700, y: 820 },
            { x: 420, y: 740 },
        ],
        color: '#c0504d',
    },

    init: {},
};

export type TVillageLocationData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};
