import { TWorldState } from 'data/TWorldState';
import { TEventId } from './TIds';
import { TLocationId } from './TLocation';
import { Time } from 'time/Time';
import { TTimeTrigger } from './TTimeTrigger';

export type TEvent<E extends TEventId> = {
    eventId: E;
    title: string;
    description: string;

    timeRange: {
        start: Time;
        end: Time;
    };
    location: TLocationId;

    children: {
        condition: string;
        event: TEvent<TEventId>;
    }[];

    triggers: TTimeTrigger[];

    init: Omit<TWorldState['events'][E], 'ref'>;
};
