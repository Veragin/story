import { TEvent } from 'types/TEvent';
import { Time } from 'time/Time';
import { TEventPassage } from 'types/TPassage';
import { introPassage } from './annie.passages/intro';
import { palacePassage } from './annie.passages/palace';
import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';

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

export type TKingdomPassageId = 'kingdom-annie-intro' | 'kingdom-annie-palace';

const kingdomEventPassages: Record<TKingdomPassageId, (s: TWorldState, e: Engine) => TEventPassage<'kingdom'>> = {
    'kingdom-annie-intro': introPassage,
    'kingdom-annie-palace': palacePassage,
};

export default kingdomEventPassages;
