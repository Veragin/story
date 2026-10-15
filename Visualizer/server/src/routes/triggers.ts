import type { TServerContext } from '../context';
import { readTrigger } from '../project/readers/triggers';
import { SourceProject } from '../project/SourceProject';
import { createTrigger, deleteTrigger, updateTrigger } from '../project/writers/triggers';

export const registerTriggerRoutes = ({ router, project, bus }: TServerContext) => {
    const sp = SourceProject.for(project);
    const w = { sp, bus };
    router
        .handle('createTrigger', ({ params, body }) => createTrigger(w, params.chapterId, body))
        .handle('getTrigger', ({ params }) => sp.run(() => readTrigger(sp, params.triggerId)))
        .handle('updateTrigger', ({ params, body }) => updateTrigger(w, params.triggerId, body))
        .handle('deleteTrigger', ({ params, body }) => deleteTrigger(w, params.triggerId, body));
};
