import { TVillageEventData } from './events/village/village.event';
import {
    TCharacter,
    TCharacterData,
    TSideCharacter,
    TSideCharacterData,
} from '../types/TCharacter';
import { TThomasCharacterData } from './characters/thomas';
import { TFrantaSideCharacterData } from './sideCharacters/Franta';
import { TVillageLocationData } from './locations/village.location';
import { TEvent } from 'types/TEvent';
import { TLocation } from 'types/TLocation';
import { TNobleManSideCharacterData } from './sideCharacters/NobleMan';
import { TAnnieCharacterData } from './characters/annie';
import { TCharacterId, TPassageId } from 'types/TIds';
import { TKingdomEventData } from './events/kingdom/kingdom.event';

export type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;
    activePassageId: TPassageId;

    characters: {
        thomas: { ref: TCharacter<'thomas'> } & TCharacterData & Partial<TThomasCharacterData>;
        annie: { ref: TCharacter<'annie'> } & TCharacterData & Partial<TAnnieCharacterData>;
    };
    sideCharacters: {
        franta: { ref: TSideCharacter<'franta'> } & TSideCharacterData &
            Partial<TFrantaSideCharacterData>;
        nobleMan: { ref: TSideCharacter<'nobleMan'> } & TSideCharacterData &
            Partial<TNobleManSideCharacterData>;
    };

    events: {
        village: { ref: TEvent<'village'> } & Partial<TVillageEventData>;
        kingdom: { ref: TEvent<'kingdom'> } & Partial<TKingdomEventData>;
    };
    locations: {
        village: { ref: TLocation<'village'> } & Partial<TVillageLocationData>;
    };
};
