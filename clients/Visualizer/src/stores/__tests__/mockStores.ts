import { ApiEvents, createMockApi, type TMockApi } from '../../api';
import { EntityStore } from '../EntityStore';
import { StructureStore } from '../StructureStore';

export type TMockStores = {
    api: TMockApi;
    events: ApiEvents;
    entities: EntityStore;
    structure: StructureStore;
    release: () => void;
};

export const createMockStores = (): TMockStores => {
    const events = new ApiEvents({ createEventSource: undefined });
    const api = createMockApi({ events });
    const entities = new EntityStore({ api, events });
    const structure = new StructureStore({ api, events, entities });
    const releaseEntities = entities.start();
    const releaseStructure = structure.start();
    return {
        api,
        events,
        entities,
        structure,
        release: () => {
            releaseStructure();
            releaseEntities();
        },
    };
};

export const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};
