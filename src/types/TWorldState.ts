import { TVillageEventData } from '../data/events/village/village.data';
import { TItem } from './TItem';

export type TWorldState = {
    time: 0;
    characters: Record<'franta', TCharacter>;

    event: {
        village: Partial<TVillageEventData>;
    };
};

type TCharacter = {
    name: string;
    location: string;
    health: number;
    energy: number;
    hunger: number;
    inventory: TItem[];
};
