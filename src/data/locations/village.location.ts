import { TLocation } from 'types/TLocation';

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

    init: {},
};

export type TVillageLocationData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};
