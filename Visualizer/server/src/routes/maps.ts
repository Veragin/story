import type { TServerContext } from '../context';
import { readMap, updateMap } from '../json/mapStore';

export const registerMapRoutes = ({ router, project, bus, stories, storyId }: TServerContext) => {
    router
        .handle('getMap', async ({ params }) =>
            readMap(project, params.mapId, (await stories.read(storyId).catch(() => null))?.mapSize)
        )
        .handle('updateMap', ({ params, body }) => updateMap({ project, bus }, params.mapId, body));
};
