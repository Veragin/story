import { createSafeContext } from '@story/ui';
import type { TimeManager } from '@story/shared';

/**
 * App-wide services shared by every page. Page state lives in each page's own MobX store, and
 * the story data comes from the server through `api` (`client/src/api`), not from here.
 */
export type TVisualizerStore = {
    /** Formats and parses story times (`d.m. h:mm`) for the timeline. */
    timeManager: TimeManager;
};

export const [visualizerStoreContext, useVisualizerStore] =
    createSafeContext<TVisualizerStore>('VisualizerStoreContext');
