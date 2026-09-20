import { Time } from '@story/shared';
import { TKingdomLocationData } from './locations/kingdom.location';
import { TWeddingChapterData } from './chapters/wedding/wedding.chapter';
import { TVillageChapterData } from './chapters/village/village.chapter';
import { TThomasCharacterData } from './characters/thomas';
import { TFrantaSideCharacterData } from './sideCharacters/Franta';
import { TVillageLocationData } from './locations/village.location';
import {
    TChapter,
    TCharacter,
    TCharacterData,
    TCharacterId,
    THappening,
    TLocation,
    TSideCharacter,
    TSideCharacterData,
} from '@story/types';
import { TNobleManSideCharacterData } from './sideCharacters/NobleMan';
import { TAnnieCharacterData } from './characters/annie';
import { TKingdomChapterData } from './chapters/kingdom/kingdom.chapter';
import type { THistoryItem } from 'code/Engine/ts/History';

export type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;
    currentHistory: Partial<Record<TCharacterId, THistoryItem>>;

    characters: {
        thomas: { ref: TCharacter<'thomas'> } & TCharacterData & Partial<TThomasCharacterData>;
        annie: { ref: TCharacter<'annie'> } & TCharacterData & Partial<TAnnieCharacterData>;
    };
    sideCharacters: {
        franta: { ref: TSideCharacter<'franta'> } & TSideCharacterData & Partial<TFrantaSideCharacterData>;
        nobleMan: { ref: TSideCharacter<'nobleMan'> } & TSideCharacterData & Partial<TNobleManSideCharacterData>;
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
    happenings: {
        village_under_attack: { ref: THappening<'village_under_attack'> };
    };
};
