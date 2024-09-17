import { TVillageData } from '../passages/Thomas/villageEvent/TVillageData';
import { TItem } from './TItem';

export type TWorldState = {
    time: 0;
    characters: Record<'franta', TCharacter>;

    village: Partial<TVillageData>;
};

type TCharacter = {
    name: string;
    location: string;
    health: number;
    energy: number;
    hunger: number;
    inventory: TItem[];
};
