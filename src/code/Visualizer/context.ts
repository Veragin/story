import { createSafeContext } from '@story/ui';
import type { TWorldState } from 'data/TWorldState';
import { Store } from './stores/Store';

export const [visualizerStoreContext, useVisualizerStore] = createSafeContext<Store>('VisualizerStoreContext');

// Deliberately duplicated from the engine's context rather than shared: sharing it would
// force the UI layer to depend on the story runtime. See REFACTOR_PLAN.md §4(c).
export const [worldStateContext, useWorldState] = createSafeContext<TWorldState>('WorldStateContext');
