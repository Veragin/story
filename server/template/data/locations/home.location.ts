import type { Location } from '@story/types';

export const homeLocation: Location<'home'> = {
    id: 'home',
    name: _('Home'),
    description: _('Where the story begins.'),

    localCharacters: [],

    init: {},
};

export type THomeLocationData = {};
