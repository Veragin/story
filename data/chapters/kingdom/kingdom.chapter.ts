import { Time } from '@story/shared';
import { TChapter } from '@story/types';
import { villageChapter } from '../village/village.chapter';

export const kingdomChapter: TChapter<'kingdom'> = {
    chapterId: 'kingdom',
    title: 'Kingdom Chapter',
    description: 'A Kingdom chapter is happening',
    timeRange: { start: Time.fromS(137325), end: Time.fromS(396525) },
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
