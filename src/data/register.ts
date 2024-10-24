import { Annie } from './characters/annie';
import { Thomas } from './characters/thomas';
import { kingdomEvent } from './events/kingdom/kingdom.event';
import { villageEvent } from './events/village/village.event';
import { village_under_attackHappening } from './happenings/village_under_attack';
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
        village: () => import('./events/village/village.passages'),
        kingdom: () => import('./events/kingdom/kingdom.passages'),
    },
    happenings: {
        village_under_attack: village_under_attackHappening,
    }
} as const;
