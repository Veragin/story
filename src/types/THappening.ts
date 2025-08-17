import { TChapterId, THappeningId } from './TIds';
import { TLocationId } from './TLocation';
import { TimeRange } from 'time/Time';
import { TChapter } from './TChapter';

export type THappening<E extends THappeningId>= {
    happeningId: E;
    title: string;
    description: string;

    timeRange: TimeRange;
    location?: TLocationId;

    childHappenings: (THappening<THappeningId> | TChapter<TChapterId>)[];
};