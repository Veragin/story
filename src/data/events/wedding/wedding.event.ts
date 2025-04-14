import { TimeRange } from 'time/Time';
import { TEvent } from 'types/TEvent';

export const weddingEvent: TEvent<'wedding'> = {
    eventId: 'wedding',
    title: _('Wedding Event'),
    description: ``,
    timeRange: TimeRange.fromString('5.1. 9:00', '6.1. 8:00'),
    location: 'kingdom',

    children: [],

    triggers: [],

    init: {},
};

export type TWeddingEventData = {};
