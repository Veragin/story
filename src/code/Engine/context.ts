import { createSafeContext } from '@story/ui';
import type { TWorldState } from 'data/TWorldState';
import { Engine, Store } from '@story/core';

export const [storeContext, useStore] = createSafeContext<Store>('StoreContext');
export const [worldStateContext, useWorldState] = createSafeContext<TWorldState>('WorldStateContext');
export const [engineContext, useEngine] = createSafeContext<Engine>('EngineContext');
