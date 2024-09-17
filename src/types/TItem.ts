import { itemInfo } from '../data/items/items';

export type TItemId = keyof typeof itemInfo;
export type TItemType = 'value' | 'resource' | 'food';

export type TItem = {
    id: TItemId;
    count: number;
};
