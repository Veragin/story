import { TVillageEventData } from './events/village/village.data';
import { TCharacterId } from '../types/TCharacter';
import { TItem } from '../types/TItem';
import { TLocationId } from 'types/TLocation';
import { Time } from 'Time/Time';

export type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;
    characters: Record<TCharacterId, TCharacterData>;

    event: {
        village: Partial<TVillageEventData>;
    };
};

type TCharacterData = {
    location: TLocationId;
    health: number;
    stamina: number;
    hunger: number;
    inventory: TItem[];
};
