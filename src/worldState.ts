import { TWorldState } from 'types/TWorldState';

export const s: TWorldState = {
    time: 0,
    characters: {},
    main: {
        name: 'main',
        health: 100,
        energy: 100,
        hunger: 100,
        inventory: [],
        location: 'start',
    },
};
