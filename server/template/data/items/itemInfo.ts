import { foodInfo } from './foodInfo';
import { toolInfo } from './toolInfo';

/** Every item of the story. Food lives in `foodInfo.ts`, tools in `toolInfo.ts`, the rest here. */
export const itemInfo = {
    gold: {
        name: 'Gold',
        type: 'value',
    },
    ...foodInfo,
    ...toolInfo,
} as const satisfies Record<string, TItemInfo & Record<string, unknown>>;

export type TItemType = 'value' | 'resource' | 'tool' | 'food' | 'weapon';

export type TItemInfo = { name: string; type: TItemType };
