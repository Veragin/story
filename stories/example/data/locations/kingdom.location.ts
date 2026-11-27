import type { Location } from '@story/types';

import { applyFormatting } from '@story/shared';
void applyFormatting;

export const kingdomLocation: Location<'kingdom'> = {
    id: 'kingdom',
    name: _('kingdom'),
    description: _(''),

    localCharacters: [],

    init: {},
};

export type TKingdomLocationData = {};
