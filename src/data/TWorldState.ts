import { TVillageEventData } from './events/village/village.event';
import { TCharacterData, TCharacterId, TSideCharacterData } from '../types/TCharacter';
import { Time } from 'Time/Time';
import { TThomasCharacterData } from './characters/Thomas';
import { TFrantaSideCharacterData } from './sideCharacters/Franta';
import { TVillageLocationData } from './locations/village.location';

export type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;

    characters: {
        thomas: TCharacterData & Partial<TThomasCharacterData>;
    };
    sideCharacters: {
        franta: TSideCharacterData & Partial<TFrantaSideCharacterData>;
    };

    events: {
        village: Partial<TVillageEventData>;
    };
    locations: {
        village: Partial<TVillageLocationData>;
    };
};
