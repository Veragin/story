import { createSafeContext } from '@story/ui';
import type { TimeManager } from '@story/shared';
import { api, apiEvents } from './api';
import { EntityStore } from './stores/EntityStore';
import { StructureStore } from './stores/StructureStore';

export type TVisualizerStore = {
    timeManager: TimeManager;
};

export const [visualizerStoreContext, useVisualizerStore] =
    createSafeContext<TVisualizerStore>('VisualizerStoreContext');

export const entityStore = new EntityStore({ api, events: apiEvents });

export const structureStore = new StructureStore({ api, events: apiEvents, entities: entityStore });
