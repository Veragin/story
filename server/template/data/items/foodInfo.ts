import type { TItemInfo } from './itemInfo';

export const foodInfo = {} as const satisfies Record<string, TItemInfo & Record<string, unknown>>;
