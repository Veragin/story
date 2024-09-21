import { Annie } from './characters/Annie';
import { Thomas } from './characters/Thomas';
import { villageEvent, villageEventPassages } from './events/village/village.event';
import { villageLocation } from './locations/village.location';
import { Franta } from './sideCharacters/Franta';
import { NobleMan } from './sideCharacters/NobleMan';

export const register = {
    characters: {
        thomas: Thomas,
        annie: Annie,
    },
    sideCharacters: {
        franta: Franta,
        nobleMan: NobleMan,
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
