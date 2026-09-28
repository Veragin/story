import type { THealthDto } from '@story/visualizer-protocol';
import type { TServerContext } from '../context';

export const registerHealthRoutes = ({ router, project, watching }: TServerContext) => {
    router.handle(
        'health',
        (): THealthDto => ({
            ok: true,
            service: '@story/visualizer-server',
            root: project.root,
            watching: watching(),
        })
    );
};
