import { TEvent } from 'types/TEvent';
import { Time } from 'time/Time';
import { nobleHouseRobberyTrigger } from './triggers';
import { TEventPassage } from 'types/TPassage';
import { introPassage } from './thomas.passages/intro';
import { forestPassage } from './thomas.passages/forest';
import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';

export const villageEvent: TEvent<'village'> = {
    eventId: 'village',
    title: 'Village Event',
    description: 'A village event is happening',
    timeRange: {
        start: Time.fromString('2.1. 8:00'),
        end: Time.fromString('5.1. 8:00'),
    },
    location: 'village',

    children: [],

    triggers: [nobleHouseRobberyTrigger],

    init: {
        mojePromena: {
            time: 0,
            asd: 'asd',
        },
    },
};

export type TVillageEventData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};

export type TVillagePassageId = 'village-thomas-intro' | 'village-thomas-forest';

const villageEventPassages: Record<TVillagePassageId, (s: TWorldState, e: Engine) => TEventPassage<'village'>> = {
    'village-thomas-intro': introPassage,
    'village-thomas-forest': forestPassage,
};

export default villageEventPassages;
