import { startChapter } from './chapters/start/start.chapter';
import { Hero } from './characters/hero';
import { homeLocation } from './locations/home.location';
import { Stranger } from './npcs/Stranger';

export const register = {
    characters: {
        hero: Hero,
    },
    npcs: {
        stranger: Stranger,
    },
    chapters: {
        start: startChapter,
    },
    locations: {
        home: homeLocation,
    },
    passages: {
        start: () => import('./chapters/start/start.passages'),
    },
} as const;

export type TRegisterPassageId = keyof typeof register.passages;
