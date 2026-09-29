import { isSourceOwner, type TSourceOwner } from '@story/visualizer-protocol';
import type { TServerContext } from '../context';
import { HttpError } from '../http/HttpError';
import { SourceProject } from '../project/SourceProject';
import { readSource, updateSource } from '../project/writers/source';

const ownerOf = (owner: string): TSourceOwner => {
    if (!isSourceOwner(owner)) throw HttpError.notFound(`No source owner "${owner}"`);
    return owner;
};

/**
 * The in-app source editor: `GET/PUT /source/:owner/:id`, the whole `.ts` file of a chapter or a
 * passage (`project/writers/source.ts`).
 */
export const registerSourceRoutes = ({ router, project, bus }: TServerContext) => {
    const sp = SourceProject.for(project);
    router
        .handle('getSource', ({ params }) => readSource(sp, ownerOf(params.owner), params.id))
        .handle('updateSource', ({ params, body }) =>
            updateSource({ sp, bus }, ownerOf(params.owner), params.id, body)
        );
};
