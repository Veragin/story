import { createSafeContext } from 'code/utils/createSafeContext';
import { Store } from './Engine/ts/Store';
import { TWorldState } from 'data/TWorldState';
import { Engine } from './Engine/ts/Engine';

export const [storeContext, useStore] = createSafeContext<Store>('StoreContext');
export const [worldStateContext, useWorldState] =
    createSafeContext<TWorldState>('WorldStateContext');
export const [engineContext, useEngine] = createSafeContext<Engine>('EngineContext');
