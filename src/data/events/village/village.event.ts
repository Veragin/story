import { TEvent } from 'types/TEvent';
import { introPassage } from './thomas.passages/intro';
import { forestPassage } from './thomas.passages/forest';
import { Time } from 'code/time/Time';
import { DAY_S } from 'code/time/const';
import { nobleHouseRobberyTrigger } from './triggers';
import { TEventPassage } from 'types/TPassage';

export const villageEvent: TEvent<'village'> = {
    eventId: 'village',
    title: 'Village Event',
    description: 'A village event is happening',
    timeRange: {
        start: Time.fromS(0),
        end: Time.fromS(2 * DAY_S),
    },
    location: 'village',

    children: [],

    triggers: [nobleHouseRobberyTrigger],

    init: {},
};

export type TVillageEventData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};

export const villageEventPassages = {
    thomas: {
        intro: introPassage,
        forest: forestPassage,
    },
} as const;

// test
Object.values(villageEventPassages)
    .flatMap((o) => Object.values(o))
    .forEach((item: () => TEventPassage<'village'>) => void item);
