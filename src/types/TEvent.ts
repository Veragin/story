export type TEvent = {
    eventId: string;
    title: string;
    description: string;

    timeRange: {
        start: number;
        end: number;
    };
    location: string;

    children: {
        condition: string;
        event: TEvent;
    }[];
};
