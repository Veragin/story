import { TLocation } from '@story/types';

import { applyFormatting } from '@story/shared';
void applyFormatting;

export const kingdomLocation: TLocation<'kingdom'> = {
    id: 'kingdom',
    name: _('kingdom'),
    description: ``,

    localCharacters: [],

    init: {},
};

export type TKingdomLocationData = {};
