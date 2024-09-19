import { TWorldState } from 'data/TWorldState';
import { TEventId } from './TCharacter';
import { TLocationId } from './TLocation';

export type TEvent<E extends TEventId> = {
    eventId: E;
    title: string;
    description: string;

    timeRange: {
        start: number;
        end: number;
    };
    location: TLocationId;

    children: {
        condition: string;
        event: TEvent<TEventId>;
    }[];

    init: Partial<TWorldState['events'][E]>;
};
