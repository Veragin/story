import { Thomas } from './characters/Thomas';
import { villageEvent, villageEventPassages } from './events/village/village.event';

export const register = {
    characters: {
        thomas: Thomas,
    },
    events: {
        village: {
            info: villageEvent,
            passages: villageEventPassages,
        },
    },
} as const;
