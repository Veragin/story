import { TEvent } from 'types/TEvent';
import { introPassage } from './thomas.passages/intro';
import { forestPassage } from './thomas.passages/forest';
import { Time } from 'time/Time';
import { nobleHouseRobberyTrigger } from './triggers';
import { TEventPassage } from 'types/TPassage';

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

export const villageEventPassages = {
    'village-thomas-intro': introPassage,
    'village-thomas-forest': forestPassage,
} as const;

// test
Object.values(villageEventPassages).forEach((item: () => TEventPassage<'village'>) => void item);
