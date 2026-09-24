import { kingdomLocation } from './locations/kingdom.location';
import { weddingChapter } from './chapters/wedding/wedding.chapter';
import { Annie } from './characters/annie';
import { Thomas } from './characters/thomas';
import { kingdomChapter } from './chapters/kingdom/kingdom.chapter';
import { villageChapter } from './chapters/village/village.chapter';
import { villageLocation } from './locations/village.location';
import { Franta } from './sideCharacters/Franta';
import { NobleMan } from './sideCharacters/NobleMan';
import { globalMap } from './maps/global.map';

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
    /* The maps locations are drawn on (VISUALIZER_PLAN §4.3). `TMapId` is `keyof` this. */
    maps: {
        global: globalMap,
    },
    passages: {
        village: () => import('./chapters/village/village.passages'),
        kingdom: () => import('./chapters/kingdom/kingdom.passages'),
        wedding: () => import('./chapters/wedding/wedding.passages'),
    },
} as const;

export type TRegisterPassageId = keyof typeof register.passages;
