import { TWorldState } from 'data/TWorldState';
import { TChapterId, THappeningId } from './ids';
import { TLocationId } from './TLocation';
import { TimeRange } from 'time/Time';
import { TChapter } from './TChapter';

export type THappening<H extends THappeningId> = {
    happeningId: H;
    title: string;
    description: string;

    timeRange: TimeRange;
    location?: TLocationId;

    childHappenings: (THappening<THappeningId> | TChapter<TChapterId>)[];

    init: Omit<TWorldState['happenings'][H], 'ref'>;
};
