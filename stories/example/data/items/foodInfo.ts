import type { TItemInfo } from './itemInfo';

export const foodInfo = {
    berries: {
        name: 'Berries',
        type: 'food',
        hungerValue: 5,
    },
} as const satisfies Record<string, TItemInfo & Record<string, unknown>>;
