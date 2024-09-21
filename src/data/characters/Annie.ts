import { TCharacter } from 'types/TCharacter';

export const Annie: TCharacter<'annie'> = {
    id: 'annie',
    name: 'Annie',

    init: {
        health: 100,
        hunger: 100,
        stamina: 100,
        inventory: [],
        location: 'village',
    },
};

export type TAnnieCharacterData = {
    knowsMagic: boolean;
};
