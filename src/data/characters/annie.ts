import { itemInfo } from 'data/items/itemInfo';
import { TCharacter } from 'types/TCharacter';

export const Annie: TCharacter<'annie'> = {
    id: 'annie',
    name: 'Annie',
    startPassageId: 'kingdom-annie-intro',

    init: {
        health: 100,
        hunger: 100,
        stamina: 100,
        inventory: [{ id: 'berries', count: 10, ...itemInfo.berries }],
        location: 'village',
    },
};

export type TAnnieCharacterData = {
    knowsMagic: boolean;
};
