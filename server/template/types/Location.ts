import type { register, TWorldState } from '@story/data';

export class Location<L extends TLocationId> {
    declare id: L;
    declare name: string;
    declare description: string;
    declare image?: string;

    declare localCharacters: {
        name: string;
        description: string;
    }[];

    declare sublocations?: Location<TLocationId>[];
    declare mapId?: string;

    declare init: Partial<TWorldState['locations'][L]>;
}

export type TLocationId = keyof (typeof register)['locations'];
