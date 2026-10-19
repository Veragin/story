import type { TItemInfo } from './itemInfo';

export const toolInfo = {
    axe: {
        name: 'Axe',
        type: 'tool',
        dmg: 10,
    },
} as const satisfies Record<string, TItemInfo & Record<string, unknown>>;
