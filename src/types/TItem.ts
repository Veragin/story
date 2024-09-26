import { itemInfo } from '../data/items/itemInfo';

export type TItemId = keyof typeof itemInfo;

type DeepWriteable<T> = {
    -readonly [P in keyof T]: T[P] extends number
        ? number
        : T[P] extends string
          ? string
          : T[P] extends boolean
            ? boolean
            : T[P] extends []
              ? DeepWriteable<T[P][number]>[] // not wokring
              : DeepWriteable<T[P]>;
};

export type TItem<I extends TItemId> = {
    id: I;
    amount: number;
} & DeepWriteable<(typeof itemInfo)[I]>;

export type TItemPartial<I extends TItemId> = { id: I } & Partial<TItem<I>>;
