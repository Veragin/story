import type { TItemInfo } from './itemInfo';

export const toolInfo = {} as const satisfies Record<string, TItemInfo & Record<string, unknown>>;
