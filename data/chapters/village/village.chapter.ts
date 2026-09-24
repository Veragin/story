import { Time } from '@story/shared';
import { TChapter } from '@story/types';
import { nobleHouseRobberyTrigger } from './triggers';

export const villageChapter: TChapter<'village'> = {
    chapterId: 'village',
    title: 'Village Chapter',
    description: 'A village chapter is happening',
    timeRange: {
        start: Time.fromString('2.1. 8:00'),
        end: Time.fromString('5.1. 8:00'),
    },
    location: 'village',

    children: [],

    triggers: [nobleHouseRobberyTrigger],

    init: {
        mojePromena: {
            time: 0,
            asd: 'asd',
        },
    },
    layout: {
        'village-thomas-cool': { x: 170, y: 92 },
        'village-thomas-forest': { x: 170, y: 366 },
        'village-thomas-intro': { x: 306, y: 213 },
    },
};

export type TVillageChapterData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};
