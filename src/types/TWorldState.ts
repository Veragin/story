import { TVillageEventData } from '../data/events/village/village.data';
import { TCharacterId } from './TCharacter';
import { TItem } from './TItem';

export type TWorldState = {
    time: 0;
    characters: Record<TCharacterId, TCharacterData>;

    event: {
        village: Partial<TVillageEventData>;
    };
};

type TCharacterData = {
    name: string;
    location: string;
    health: number;
    energy: number;
    hunger: number;
    inventory: TItem[];
};
