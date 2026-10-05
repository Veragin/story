import type { StructureStore } from '../../stores/StructureStore';
import type { EntityFormStore } from './EntityFormStore';

export type TEntityFieldsProps<D> = {
    store: EntityFormStore;
    structure: StructureStore;
    draft: D;
};
