import type { TItemInfo } from './itemInfo';

export const foodInfo = {
    berries: {
        name: _('Berries'),
        type: 'food',
        hungerValue: 5,
    },
} as const satisfies Record<string, TItemInfo & Record<string, unknown>>;
