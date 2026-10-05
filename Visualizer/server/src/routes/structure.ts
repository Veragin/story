import type { TStructureDto } from '@story/visualizer-protocol';
import type { TServerContext } from '../context';
import { readStructure } from '../project/readers/structure';
import { SourceProject } from '../project/SourceProject';
import { addLiteralValue, createLiteral, deleteLiteral, updateLiteral } from '../project/writers/literals';
import { createType, deleteType, updateType } from '../project/writers/structure';

// engine types stay server-side: the writers still check names against them
const publicStructure = (sp: SourceProject): TStructureDto => {
    const structure = readStructure(sp);
    return { ...structure, types: structure.types.filter((type) => type.origin !== 'engine') };
};

export const registerStructureRoutes = ({ router, project, bus }: TServerContext) => {
    const sp = SourceProject.for(project);
    const w = { sp, bus };
    router
        .handle('getStructure', () => sp.run(() => publicStructure(sp)))
        .handle('createType', ({ body }) => createType(w, body))
        .handle('updateType', ({ params, body }) => updateType(w, params.name, body))
        .handle('deleteType', ({ params, body }) => deleteType(w, params.name, body))
        .handle('createLiteral', ({ body }) => createLiteral(w, body))
        .handle('updateLiteral', ({ params, body }) => updateLiteral(w, params.name, body))
        .handle('addLiteralValue', ({ params, body }) => addLiteralValue(w, params.name, body))
        .handle('deleteLiteral', ({ params, body }) => deleteLiteral(w, params.name, body));
};
