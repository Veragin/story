import { createSafeContext } from '@story/ui';
import type { TimeManager } from '@story/shared';
import { api, apiEvents, auth } from './api';
import { GitStore } from './git/GitStore';
import { EntityStore } from './stores/EntityStore';
import { StructureStore } from './stores/StructureStore';

export type TVisualizerStore = {
    timeManager: TimeManager;
};

export const [visualizerStoreContext, useVisualizerStore] =
    createSafeContext<TVisualizerStore>('VisualizerStoreContext');

export const entityStore = new EntityStore({ api, events: apiEvents });

export const structureStore = new StructureStore({ api, events: apiEvents, entities: entityStore });

export const gitStore = new GitStore({ api, events: apiEvents, auth });
