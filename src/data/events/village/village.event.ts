import { TEvent } from 'types/TEvent';
import { introPassage } from './thomas.passages/intro';
import { villagePassage } from './thomas.passages/village';

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
        start: 0,
        end: 0,
    },
    location: 'village',

    children: [],

    init: {},
};

export type TVillageEventData = {
    mojePromena: {
        time: number;
        asd: string;
    };
};
