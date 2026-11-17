import { useEffect } from 'react';
import type { EntityStore } from '../../../stores/EntityStore';
import type { StructureStore } from '../../../stores/StructureStore';

export const useStructureStores = (entities: EntityStore, structure: StructureStore) => {
    useEffect(() => {
        const releaseEntities = entities.start();
        const releaseStructure = structure.start();
        return () => {
            releaseStructure();
            releaseEntities();
        };
    }, [entities, structure]);
};
