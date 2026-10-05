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
} as const;

export type TItemType = 'value' | 'resource' | 'tool' | 'food' | 'weapon';

type TItemInfo = {
    name: string;
    type: TItemType;
};
// test
Object.values(itemInfo).forEach((item: TItemInfo) => void item);
