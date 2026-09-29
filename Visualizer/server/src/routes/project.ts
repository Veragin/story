import type { TServerContext } from '../context';
import { readProject } from '../project/readers/project';
import { SourceProject } from '../project/SourceProject';

/** `GET /project` — ids and display names behind every picker and the Timeline. */
export const registerProjectRoutes = ({ router, project }: TServerContext) => {
    const sp = SourceProject.for(project);
    router.handle('getProject', () => sp.run(() => readProject(sp)));
};
