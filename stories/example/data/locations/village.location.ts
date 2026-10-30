import { TLocation } from '@story/types';

export const villageLocation: TLocation<'village'> = {
    id: 'village',
    name: _('Village'),
    description: _('The village is a small place, with a few houses and a tavern.'),

    localCharacters: [
        {
            name: _('Pepa'),
            description: _('Pepa is a very smart'),
        },
    ],

    init: {},
};

export type TVillageLocationData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};
