import type { TServerContext } from '../context';
import { readProject } from '../project/readers/project';
import { SourceProject } from '../project/SourceProject';

export const registerProjectRoutes = ({ router, project }: TServerContext) => {
    const sp = SourceProject.for(project);
    router.handle('getProject', () => sp.run(() => readProject(sp)));
};
