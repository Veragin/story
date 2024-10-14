import { TEvent } from 'types/TEvent';
import { Time } from 'time/Time';
import { nobleHouseRobberyTrigger } from './triggers';

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
