import { Time } from '@story/shared';
import { TKingdomLocationData } from './locations/kingdom.location';
import { TWeddingChapterData } from './chapters/wedding/wedding.chapter';
import { TVillageChapterData } from './chapters/village/village.chapter';
import { TThomasCharacterData } from './characters/thomas';
import { TFrantaNpcData } from './npcs/Franta';
import { TVillageLocationData } from './locations/village.location';
import { TChapter, TCharacter, TCharacterData, TCharacterId, TLocation, TNpc, TNpcData } from '@story/types';
import { TNobleManNpcData } from './npcs/NobleMan';
import { TAnnieCharacterData } from './characters/annie';
import { TKingdomChapterData } from './chapters/kingdom/kingdom.chapter';
import type { THistoryItem } from '@story/core';

export type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;
    currentHistory: Partial<Record<TCharacterId, THistoryItem>>;

    characters: {
        thomas: { ref: TCharacter<'thomas'> } & TCharacterData & Partial<TThomasCharacterData>;
        annie: { ref: TCharacter<'annie'> } & TCharacterData & Partial<TAnnieCharacterData>;
    };
    npcs: {
        franta: { ref: TNpc<'franta'> } & TNpcData & Partial<TFrantaNpcData>;
        nobleMan: { ref: TNpc<'nobleMan'> } & TNpcData & Partial<TNobleManNpcData>;
    };

    chapters: {
        village: { ref: TChapter<'village'> } & TVillageChapterData;
        kingdom: { ref: TChapter<'kingdom'> } & TKingdomChapterData;
        wedding: { ref: TChapter<'wedding'> } & TWeddingChapterData;
    };
    locations: {
        village: { ref: TLocation<'village'> } & TVillageLocationData;
        kingdom: { ref: TLocation<'kingdom'> } & Partial<TKingdomLocationData>;
    };
};
