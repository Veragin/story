import { TSideCharacter } from 'types/TCharacter';

export const Franta: TSideCharacter<'franta'> = {
    id: 'franta',
    name: 'Franta',
    description: 'Franta is a very old',

    init: {
        inventory: [],
        location: 'village',
        isDead: false,
    },
};

export type TFrantaSideCharacterData = {
    asdasd: {
        time: number;
        asd: string;
    };
};
