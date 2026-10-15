import { TCharacter } from '@story/types';

export const Hero: TCharacter<'hero'> = {
    id: 'hero',
    name: 'Hero',
    startPassageId: 'start-hero-intro',

    init: {
        health: 100,
        inventory: [],
        location: 'home',
    },
};

export type THeroCharacterData = {};
