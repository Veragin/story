import type { THealthDto } from '@story/visualizer-protocol';
import type { TGlobalContext } from '../context';

export const registerHealthRoutes = ({ router, stories, watch }: TGlobalContext) => {
    router.handle(
        'health',
        (): THealthDto => ({
            ok: true,
            service: '@story/visualizer-server',
            storiesRoot: stories.root,
            watching: watch,
        })
    );
};
