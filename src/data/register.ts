import { Thomas } from './characters/Thomas';
import { villageEvent, villageEventPassages } from './events/village/village.event';
import { villageLocation } from './locations/village';

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
    locations: {
        village: villageLocation,
    },
} as const;
