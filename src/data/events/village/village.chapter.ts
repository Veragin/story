import { TChapter } from 'types/TChapter';
import { Time } from 'time/Time';
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
};

export type TVillageChapterData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};
