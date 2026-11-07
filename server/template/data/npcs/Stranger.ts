import type { Npc } from '@story/types';

export const Stranger: Npc<'stranger'> = {
    id: 'stranger',
    name: _('Stranger'),
    description: _('Someone the hero has not met yet.'),

    init: {
        inventory: [],
        location: 'home',
        isDead: false,
    },
};

export type TStrangerNpcData = {};
