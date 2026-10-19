import { foodInfo } from './foodInfo';
import { toolInfo } from './toolInfo';
import { applyFormatting } from '@story/shared';
void applyFormatting;

export const itemInfo = {
    gold: {
        name: 'Gold',
        type: 'value',
    },
    ...foodInfo,
    ...toolInfo,
    wood: {
        name: 'Wood',
        type: 'resource',
    },
    bow: {
        name: 'Bow',
        type: 'weapon',
        damage: 10,
        asd: { asd: 'asdas', time: false },
    },
} as const satisfies Record<string, TItemInfo & Record<string, unknown>>;

export type TItemType = 'value' | 'resource' | 'tool' | 'food' | 'weapon';

export type TItemInfo = { name: string; type: TItemType };
