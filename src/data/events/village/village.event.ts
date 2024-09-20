import { TEvent } from 'types/TEvent';
import { introPassage } from './thomas.passages/intro';
import { villagePassage } from './thomas.passages/village';
import { Time } from 'Time/Time';
import { DAY_S } from 'Time/const';
import { nobleHouseRobberyTrigger } from './triggers';

export const villageEventPassages = {
    thomas: {
        intro: introPassage,
        forest: villagePassage,
    },
} as const;

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
