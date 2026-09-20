import { TLocation } from '@story/types';

import { applyFormatting } from '@story/ui';
void applyFormatting;

export const kingdomLocation: TLocation<'kingdom'> = {
    id: 'kingdom',
    name: _('kingdom'),
    description: ``,

    localCharacters: [],

    init: {},
};

export type TKingdomLocationData = {};
