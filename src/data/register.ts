import { Annie } from './characters/Annie';
import { Thomas } from './characters/Thomas';
import { kingdomEvent, kingdomEventPassages } from './events/kingdom/kingdom.event';
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
        village: villageEvent,
        kingdom: kingdomEvent,
    },
    locations: {
        village: villageLocation,
    },
    passages: {
        ...villageEventPassages,
        ...kingdomEventPassages,
    },
} as const;
