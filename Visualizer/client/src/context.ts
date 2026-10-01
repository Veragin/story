import { createSafeContext } from '@story/ui';
import type { TimeManager } from '@story/shared';

export type TVisualizerStore = {
    timeManager: TimeManager;
};

export const [visualizerStoreContext, useVisualizerStore] =
    createSafeContext<TVisualizerStore>('VisualizerStoreContext');
