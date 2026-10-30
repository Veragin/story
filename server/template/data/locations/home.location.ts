import { TLocation } from '@story/types';

export const homeLocation: TLocation<'home'> = {
    id: 'home',
    name: _('Home'),
    description: _('Where the story begins.'),

    localCharacters: [],

    init: {},
};

export type THomeLocationData = {};
