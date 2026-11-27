import { TNpc } from '@story/types';

export const Franta: TNpc<'franta'> = {
    id: 'franta',
    name: _('Franta'),
    description: _('Franta is a very old'),

    init: {
        inventory: [],
        location: 'village',
        isDead: false,
    },
};

export type TFrantaNpcData = {
    asdasd: {
        time: number;
        asd: string;
    };
};
