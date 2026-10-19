import { Time } from '@story/shared';
import { TChapter } from '@story/types';

export const startChapter: TChapter<'start'> = {
    chapterId: 'start',
    title: 'Start',
    description: 'The first chapter.',
    timeRange: {
        start: Time.fromString('1.1. 8:00'),
        end: Time.fromString('1.1. 20:00'),
    },
    location: 'home',

    children: [],

    triggers: [],

    init: {},
};

export type TStartChapterData = {};
