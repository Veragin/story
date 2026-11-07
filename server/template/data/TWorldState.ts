import { Time } from '@story/shared';
import type { TChapter, Character, TCharacterData, TCharacterId, Location, Npc, TNpcData } from '@story/types';
import type { THistoryItem } from '@story/core';
import { TStartChapterData } from './chapters/start/start.chapter';
import { THeroCharacterData } from './characters/hero';
import { THomeLocationData } from './locations/home.location';
import { TStrangerNpcData } from './npcs/Stranger';

export type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;
    currentHistory: Partial<Record<TCharacterId, THistoryItem>>;

    characters: {
        hero: { ref: Character<'hero'> } & TCharacterData & Partial<THeroCharacterData>;
    };
    npcs: {
        stranger: { ref: Npc<'stranger'> } & TNpcData & Partial<TStrangerNpcData>;
    };

    chapters: {
        start: { ref: TChapter<'start'> } & TStartChapterData;
    };
    locations: {
        home: { ref: Location<'home'> } & THomeLocationData;
    };
};
