import { items } from '../const/items';

export type TItemId = (typeof items)[number]['id'];
export type TItemType = (typeof items)[number]['type'];

export type TItem = {
    id: TItemId;
    count: number;
};
