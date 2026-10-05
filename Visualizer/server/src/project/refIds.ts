import {
    refTarget,
    typeDefaultContext,
    type TStructureDto,
    type TTypeDefaultContext,
} from '@story/visualizer-protocol';
import { itemNodes, registerEntriesOf } from './readers/entities';
import { catalogIds } from './readers/structure';
import type { SourceProject } from './SourceProject';
import { chapterIds } from './story';

/** The ids a `ref` field of that type can hold, in file order. */
export const refIdsOf =
    (sp: SourceProject, structure: TStructureDto) =>
    (refName: string): string[] => {
        const target = refTarget(refName, structure);
        if (!target) return [];
        switch (target.source) {
            case 'entities':
                return target.kind === 'items'
                    ? itemNodes(sp).map((n) => n.id)
                    : registerEntriesOf(sp, target.kind).map((e) => e.id);
            case 'chapters':
                return chapterIds(sp);
            case 'catalog':
                return catalogIds(sp, target.catalog);
        }
    };

export const storyTypeDefaultContext = (sp: SourceProject, structure: TStructureDto): TTypeDefaultContext =>
    typeDefaultContext(structure, refIdsOf(sp, structure));
