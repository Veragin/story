import type { Character } from '@story/types';

export const Thomas: Character<'thomas'> = {
    id: 'thomas',
    name: _('Thomas'),
    startPassageId: 'village-thomas-intro',

    init: {
        health: 100,
        inventory: [{ id: 'bow', amount: 1 }],
        location: 'village',
    },
};

export type TThomasCharacterData = {
    knowsMagic: boolean;
};
