import { TEventId } from './TCharacter';
import { TLocationId } from './TLocation';

export type TEvent = {
    eventId: TEventId;
    title: string;
    description: string;

    timeRange: {
        start: number;
        end: number;
    };
    location: TLocationId;

    children: {
        condition: string;
        event: TEvent;
    }[];
};
