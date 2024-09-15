import { TItem } from './TItem';

export type TWorldState = {
    time: 0;
    main: TCharacter;
    characters: Record<string, TCharacter>;
};

type TCharacter = {
    name: string;
    health: number;
    energy: number;
    hunger: number;
    inventory: TItem[];
    location: string;
};
