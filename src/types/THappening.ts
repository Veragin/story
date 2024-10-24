import { TEventId, THappeningId } from './TIds';
import { TLocationId } from './TLocation';
import { TimeRange } from 'time/Time';
import { TEvent } from './TEvent';

export type THappening<E extends THappeningId>= {
    happeningId: E;
    title: string;
    description: string;

    timeRange: TimeRange;
    location?: TLocationId;

    childHappenings: (THappening<THappeningId> | TEvent<TEventId>)[];
};