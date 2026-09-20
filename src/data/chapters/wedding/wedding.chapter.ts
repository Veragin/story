import { TimeRange } from '@story/shared';
import { TChapter } from '@story/types';

export const weddingChapter: TChapter<'wedding'> = {
    chapterId: 'wedding',
    title: _('Wedding Chapter'),
    description: ``,
    timeRange: TimeRange.fromString('5.1. 9:00', '6.1. 8:00'),
    location: 'kingdom',

    children: [],

    triggers: [],

    init: {},
};

export type TWeddingChapterData = {};
