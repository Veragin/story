import { Time } from '@story/shared';
import { TKingdomLocationData } from './locations/kingdom.location';
import { TWeddingChapterData } from './chapters/wedding/wedding.chapter';
import { TVillageChapterData } from './chapters/village/village.chapter';
import { TThomasCharacterData } from './characters/thomas';
import { TFrantaNpcData } from './npcs/Franta';
import { TVillageLocationData } from './locations/village.location';
import type { TChapter, Character, TCharacterData, TCharacterId, Location, Npc, TNpcData } from '@story/types';
import { TNobleManNpcData } from './npcs/NobleMan';
import { TAnnieCharacterData } from './characters/annie';
import { TKingdomChapterData } from './chapters/kingdom/kingdom.chapter';
import type { THistoryItem } from '@story/core';

export type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;
    currentHistory: Partial<Record<TCharacterId, THistoryItem>>;

    characters: {
        thomas: { ref: Character<'thomas'> } & TCharacterData & Partial<TThomasCharacterData>;
        annie: { ref: Character<'annie'> } & TCharacterData & Partial<TAnnieCharacterData>;
    };
    npcs: {
        franta: { ref: Npc<'franta'> } & TNpcData & Partial<TFrantaNpcData>;
        nobleMan: { ref: Npc<'nobleMan'> } & TNpcData & Partial<TNobleManNpcData>;
    };

    chapters: {
        village: { ref: TChapter<'village'> } & TVillageChapterData;
        kingdom: { ref: TChapter<'kingdom'> } & TKingdomChapterData;
        wedding: { ref: TChapter<'wedding'> } & TWeddingChapterData;
    };
    locations: {
        village: { ref: Location<'village'> } & TVillageLocationData;
        kingdom: { ref: Location<'kingdom'> } & Partial<TKingdomLocationData>;
    };
};
