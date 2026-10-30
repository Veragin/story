import { TNpc } from '@story/types';

export const NobleMan: TNpc<'nobleMan'> = {
    id: 'nobleMan',
    name: _('Noble Man'),
    description: _('Noble Man is a very rich and powerful'),

    init: {
        inventory: [],
        location: 'village',
        isDead: false,
    },
};

export type TNobleManNpcData = {
    asdasd: {
        time: number;
        asd: string;
    };
};
