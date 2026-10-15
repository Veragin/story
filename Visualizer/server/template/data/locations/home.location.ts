import { TLocation } from '@story/types';

export const homeLocation: TLocation<'home'> = {
    id: 'home',
    name: 'Home',
    description: 'Where the story begins.',

    localCharacters: [],

    init: {},
};

export type THomeLocationData = {};
