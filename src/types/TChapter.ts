import { TWorldState } from 'data/TWorldState';
import { TChapterId } from './TIds';
import { TLocationId } from './TLocation';
import { TimeRange } from 'time/Time';
import { TTimeTrigger } from './TTimeTrigger';

export type TChapter<E extends TChapterId> = {
    chapterId: E;
    title: string;
    description: string;

    timeRange: TimeRange;
    location: TLocationId;

    children: {
        condition: string;
        chapter: TChapter<TChapterId>;
    }[];

    triggers: TTimeTrigger[];

    init: Omit<TWorldState['chapters'][E], 'ref'>;
};
