import { TLocation } from 'types/TLocation';

import { applyFormatting } from 'code/utils/translations';
void applyFormatting;

export const kingdomLocation: TLocation<'kingdom'> = {
    id: 'kingdom',
    name: _('kingdom'),
    description: ``,

    localCharacters: [],

    init: {},
};

export type TKingdomLocationData = {};
