import { TChapter } from 'types/TChapter';
import { Time } from 'time/Time';
import { villageChapter } from '../village/village.chapter';

export const kingdomChapter: TChapter<'kingdom'> = {
    chapterId: 'kingdom',
    title: 'Kingdom Chapter',
    description: 'A Kingdom chapter is happening',
    timeRange: {
        start: Time.fromString('2.1. 8:00'),
        end: Time.fromString('5.1. 8:00'),
    },
    location: 'village',

    children: [
        {
            condition: 'asdasd',
            chapter: villageChapter,
        },
    ],

    triggers: [],

    init: {
        mojePromena: {
            time: 0,
            asd: 'asd',
        },
    },
};

export type TKingdomChapterData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};
