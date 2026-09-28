import type { TWorldState } from '@story/data';
import { TChapterId } from './ids';
import { TLocationId } from './TLocation';
import { TimeRange } from '@story/shared';
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
