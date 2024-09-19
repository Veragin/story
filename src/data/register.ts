import { Thomas } from './characters/Thomas';
import { villageEvent, villageEventPassages } from './events/village/village.event';
import { villageLocation } from './locations/village.location';
import { Franta } from './sideCharacters/Franta';

export const register = {
    characters: {
        thomas: Thomas,
    },
    sideCharacters: {
        franta: Franta,
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
