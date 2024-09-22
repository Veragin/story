import { TEvent } from 'types/TEvent';
import { Time } from 'code/time/Time';
import { DAY_S } from 'code/time/const';
import { TEventPassage } from 'types/TPassage';
import { introPassage } from './annie.passages/intro';

export const kingdomEvent: TEvent<'kingdom'> = {
    eventId: 'kingdom',
    title: 'Kingdom Event',
    description: 'A Kingdom event is happening',
    timeRange: {
        start: Time.fromS(0),
        end: Time.fromS(2 * DAY_S),
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
