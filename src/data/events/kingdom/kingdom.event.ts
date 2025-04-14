import { TEvent } from 'types/TEvent';
import { Time } from 'time/Time';
import { villageEvent } from '../village/village.event';

export const kingdomEvent: TEvent<'kingdom'> = {
    eventId: 'kingdom',
    title: 'Kingdom Event',
    description: 'A Kingdom event is happening',
    timeRange: {
        start: Time.fromString('2.1. 8:00'),
        end: Time.fromString('5.1. 8:00'),
    },
    location: 'village',

    children: [
        {
            condition: 'asdasd',
            event: villageEvent,
        },
    ],

    triggers: [],

    init: {
        mojePromena: {
            time: 0,
            asd: 'asd',
        },
    },
};

export type TKingdomEventData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};
