import { register } from 'data/register';

export type TLocation = {
    id: TLocationId;
    name: string;
    description: string;

    localCharacters: {
        name: string;
        description: string;
    }[];
};

export type TLocationId = keyof (typeof register)['locations'];
