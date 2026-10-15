import { Time } from '@story/shared';
import { TChapter, TCharacter, TCharacterData, TCharacterId, TLocation, TNpc, TNpcData } from '@story/types';
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
        hero: { ref: TCharacter<'hero'> } & TCharacterData & Partial<THeroCharacterData>;
    };
    npcs: {
        stranger: { ref: TNpc<'stranger'> } & TNpcData & Partial<TStrangerNpcData>;
    };

    chapters: {
        start: { ref: TChapter<'start'> } & TStartChapterData;
    };
    locations: {
        home: { ref: TLocation<'home'> } & THomeLocationData;
    };
};
