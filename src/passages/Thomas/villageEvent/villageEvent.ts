import { TEvent } from 'types/TEvent';
import { introPassage } from './passages/intro';
import { villagePassage } from './passages/village';

export const villageEventPassages = {
    intro: introPassage,
    village: villagePassage,
} as const;

export const villageEvent: TEvent<'thomas'> = {
    eventId: 'village',
    title: 'Village Event',
    description: 'A village event is happening',
    timeRange: {
        start: 0,
        end: 0,
    },
    location: 'village',

    children: [],
    passages: villageEventPassages,

    startPassageId: 'intro',
};
