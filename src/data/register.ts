import { kingdomLocation } from './locations/kingdom.location';
import { weddingChapter } from './chapters/wedding/wedding.chapter';
import { Annie } from './characters/annie';
import { Thomas } from './characters/thomas';
import { kingdomChapter } from './chapters/kingdom/kingdom.chapter';
import { villageChapter } from './chapters/village/village.chapter';
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
    chapters: {
    	village: villageChapter,
        kingdom: kingdomChapter,
    	wedding: weddingChapter,
    },
    locations: {
    	village: villageLocation,
    	kingdom: kingdomLocation,
    },
    passages: {
    	village: () => import('./chapters/village/village.passages'),
        kingdom: () => import('./chapters/kingdom/kingdom.passages'),
    	wedding: () => import('./chapters/wedding/wedding.passages'),
    },
    happenings: {
        village_under_attack: village_under_attackHappening,
    }
} as const;

export type TRegisterPassageId = keyof typeof register.passages;