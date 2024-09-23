import { TEvent } from 'types/TEvent';
import { Time } from 'time/Time';
import { TEventPassage } from 'types/TPassage';
import { introPassage } from './annie.passages/intro';

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

    init: {},
};

export type TKingdomEventData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};

export const kingdomEventPassages = {
    'kingdom-annie-intro': introPassage,
} as const;

// test
Object.values(kingdomEventPassages).forEach((item: () => TEventPassage<'kingdom'>) => void item);
