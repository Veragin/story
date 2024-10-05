import { TCharacter } from 'types/TCharacter';

export const Thomas: TCharacter<'thomas'> = {
    id: 'thomas',
    name: 'Thomas',
    startPassageId: 'village-thomas-intro',

    init: {
        health: 100,
        hunger: 100,
        stamina: 100,
        inventory: [{ id: 'bow', amount: 1 }],
        location: 'village',
    },
};

export type TThomasCharacterData = {
    knowsMagic: boolean;
};
