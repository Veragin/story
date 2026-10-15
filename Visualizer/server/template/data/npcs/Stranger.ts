import { TNpc } from '@story/types';

export const Stranger: TNpc<'stranger'> = {
    id: 'stranger',
    name: 'Stranger',
    description: 'Someone the hero has not met yet.',

    init: {
        inventory: [],
        location: 'home',
        isDead: false,
    },
};

export type TStrangerNpcData = {};
