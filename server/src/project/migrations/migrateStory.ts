import type { EventBus } from '../../events/EventBus';
import type { SourceProject } from '../SourceProject';
import { migrateClassLayout } from './classLayout';
import { migratePassageStructure } from './passageStructure';
import { migrateStructureLayout } from './structureLayout';

export const migrateStory = async (sp: SourceProject, bus: EventBus) => {
    await migrateStructureLayout(sp, bus);
    await migrateClassLayout(sp, bus);
    await migratePassageStructure(sp, bus);
};
