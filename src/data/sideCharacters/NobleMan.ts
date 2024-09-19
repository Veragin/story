import { TSideCharacter } from 'types/TCharacter';

export const NobleMan: TSideCharacter<'nobleMan'> = {
    id: 'nobleMan',
    name: 'Noble Man',
    description: 'Noble Man is a very rich and powerful',

    init: {
        inventory: [],
        location: 'village',
    },
};

export type TNobleManSideCharacterData = {
    asdasd: {
        time: number;
        asd: string;
    };
};
