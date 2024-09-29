import { TVillageEventData } from './events/village/village.event';
import { TCharacter, TCharacterData, TSideCharacter, TSideCharacterData } from '../types/TCharacter';
import { TThomasCharacterData } from './characters/thomas';
import { TFrantaSideCharacterData } from './sideCharacters/Franta';
import { TVillageLocationData } from './locations/village.location';
import { TEvent } from 'types/TEvent';
import { TLocation } from 'types/TLocation';
import { TNobleManSideCharacterData } from './sideCharacters/NobleMan';
import { TAnnieCharacterData } from './characters/annie';
import { TKingdomEventData } from './events/kingdom/kingdom.event';
import { TCharacterId } from 'types/TIds';
import { THistoryItem } from 'code/Engine/ts/History';

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

    events: {
        village: { ref: TEvent<'village'> } & TVillageEventData;
        kingdom: { ref: TEvent<'kingdom'> } & TKingdomEventData;
    };
    locations: {
        village: { ref: TLocation<'village'> } & TVillageLocationData;
    };
};
