import { register } from 'data/register';
import { TWorldState } from 'data/TWorldState';

export type TLocation<L extends TLocationId> = {
    id: L;
    name: string;
    description: string;

    localCharacters: {
        name: string;
        description: string;
    }[];

    sublocations?: TLocation<TLocationId>[];

    x?: number;
    y?: number;

    init: Partial<TWorldState['locations'][L]>;
};

export type TLocationId = keyof (typeof register)['locations'];
