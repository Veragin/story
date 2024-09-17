import { villageEvent, villageEventPassages } from './villageEvent/villageEvent';

export const Thomas = {
    id: 'thomas',
    name: 'Thomas',

    events: {
        village: {
            info: villageEvent,
            passages: villageEventPassages,
        },
    },
} as const;
