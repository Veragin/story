import { Time } from 'Time/Time';
import { TWorldState } from 'data/TWorldState';

export const s: TWorldState = {
    time: Time.fromMin(0),
    mainCharacterId: 'thomas',
    characters: {
        thomas: {
            health: 100,
            stamina: 100,
            hunger: 100,
            inventory: [],
            location: 'village',
        },
    },

    event: {
        village: {},
    },
};
