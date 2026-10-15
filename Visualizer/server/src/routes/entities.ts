import { isEntityKind, type TEntityKind } from '@story/visualizer-protocol';
import type { TServerContext } from '../context';
import { pathParam } from '../http/params';
import { listEntities, readEntity } from '../project/readers/entities';
import { SourceProject } from '../project/SourceProject';
import { createEntity, deleteEntity, updateEntity } from '../project/writers/entities';

const kindOf = (kind: string): TEntityKind => pathParam(kind, isEntityKind, 'entity kind');

export const registerEntityRoutes = ({ router, project, bus }: TServerContext) => {
    const sp = SourceProject.for(project);
    const w = { sp, bus };
    router
        .handle('listEntities', ({ params }) =>
            sp.run(() => {
                const kind = kindOf(params.kind);
                return { kind, entities: listEntities(sp, kind) };
            })
        )
        .handle('createEntity', ({ params, body }) => createEntity(w, kindOf(params.kind), body))
        .handle('getEntity', ({ params }) => sp.run(() => readEntity(sp, kindOf(params.kind), params.id)))
        .handle('updateEntity', ({ params, body }) => updateEntity(w, kindOf(params.kind), params.id, body))
        .handle('deleteEntity', ({ params, body }) => deleteEntity(w, kindOf(params.kind), params.id, body));
};
