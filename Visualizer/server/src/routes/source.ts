import { isSourceOwner, type TSourceOwner } from '@story/visualizer-protocol';
import type { TServerContext } from '../context';
import { pathParam } from '../http/params';
import { SourceProject } from '../project/SourceProject';
import { readSource, updateSource } from '../project/writers/source';

const ownerOf = (owner: string): TSourceOwner => pathParam(owner, isSourceOwner, 'source owner');

export const registerSourceRoutes = ({ router, project, bus }: TServerContext) => {
    const sp = SourceProject.for(project);
    router
        .handle('getSource', ({ params }) => readSource(sp, ownerOf(params.owner), params.id))
        .handle('updateSource', ({ params, body }) =>
            updateSource({ sp, bus }, ownerOf(params.owner), params.id, body)
        );
};
