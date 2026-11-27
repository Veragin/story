import type { Character } from '@story/types';

export const Hero: Character<'hero'> = {
    id: 'hero',
    name: _('Hero'),
    startPassageId: 'start-hero-intro',

    init: {
        health: 100,
        inventory: [],
        location: 'home',
    },
};

export type THeroCharacterData = {};
