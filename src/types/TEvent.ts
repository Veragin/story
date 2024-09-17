import { TEventId } from './TCharacter';

export type TEvent<E extends TEventId> = {
    eventId: E;
    title: string;
    description: string;

    timeRange: {
        start: number;
        end: number;
    };
    location: string;

    children: {
        condition: string;
        event: TEvent<TEventId>;
    }[];
};
