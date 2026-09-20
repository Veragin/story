import { createSafeContext } from '@story/ui';
import type { TWorldState } from '@story/data';
import { Engine, Store } from '@story/core';

export const [storeContext, useStore] = createSafeContext<Store>('StoreContext');
export const [worldStateContext, useWorldState] = createSafeContext<TWorldState>('WorldStateContext');
export const [engineContext, useEngine] = createSafeContext<Engine>('EngineContext');
