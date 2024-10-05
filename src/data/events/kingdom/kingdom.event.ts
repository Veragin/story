import { TEvent } from 'types/TEvent';
import { Time } from 'time/Time';
import { TEventPassage } from 'types/TPassage';

export const kingdomEvent: TEvent<'kingdom'> = {
    eventId: 'kingdom',
    title: 'Kingdom Event',
    description: 'A Kingdom event is happening',
    timeRange: {
        start: Time.fromString('2.1. 8:00'),
        end: Time.fromString('5.1. 8:00'),
    },
    location: 'village',

    children: [],

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

export const kingdomEventPassages = {
    'kingdom-annie-intro': () => import('./annie.passages/intro'),
    'kingdom-annie-palace': () => import('./annie.passages/palace'),
} as const;

// test
Object.values(kingdomEventPassages).forEach(
    (item: () => Promise<{ default: () => TEventPassage<'kingdom'> }>) => void item
);
