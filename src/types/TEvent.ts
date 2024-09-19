import { TWorldState } from 'data/TWorldState';
import { TEventId } from './TCharacter';
import { TLocationId } from './TLocation';
import { Time } from 'Time/Time';

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

    init: Partial<TWorldState['events'][E]>;
};
