import { TVillageEventData } from './events/village/village.event';
import {
    TCharacter,
    TCharacterData,
    TCharacterId,
    TSideCharacter,
    TSideCharacterData,
} from '../types/TCharacter';
import { Time } from 'code/time/Time';
import { TThomasCharacterData } from './characters/Thomas';
import { TFrantaSideCharacterData } from './sideCharacters/Franta';
import { TVillageLocationData } from './locations/village.location';
import { TEvent } from 'types/TEvent';
import { TLocation } from 'types/TLocation';
import { TNobleManSideCharacterData } from './sideCharacters/NobleMan';
import { TAnnieCharacterData } from './characters/Annie';

export type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;

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
    };
    locations: {
        village: { ref: TLocation<'village'> } & Partial<TVillageLocationData>;
    };
};
