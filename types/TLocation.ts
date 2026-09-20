import type { register, TWorldState } from '@story/data';

export type TLocation<L extends TLocationId> = {
    id: L;
    name: string;
    description: string;

    localCharacters: {
        name: string;
        description: string;
    }[];

    sublocations?: TLocation<TLocationId>[];
    mapId?: string;

    init: Partial<TWorldState['locations'][L]>;
};

export type TLocationId = keyof (typeof register)['locations'];
