import { createSafeContext } from 'code/utils/createSafeContext';
import type { TWorldState } from 'data/TWorldState';
import { Store } from './ts/Store';
import { Engine } from './ts/Engine';

export const [storeContext, useStore] = createSafeContext<Store>('StoreContext');
export const [worldStateContext, useWorldState] = createSafeContext<TWorldState>('WorldStateContext');
export const [engineContext, useEngine] = createSafeContext<Engine>('EngineContext');
