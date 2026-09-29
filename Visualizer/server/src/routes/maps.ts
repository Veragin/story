import type { TServerContext } from '../context';
import { readMap, updateMap } from '../json/mapStore';

/**
 * The map: `/maps/:mapId` (`data/locations/map.json`, only `global`; any other id is a 404).
 * `GET` answers an empty map of the story's `mapSize` (`story.json`) with `version: ''` while the
 * file is missing; `PUT` is a validated whole-document replace (400 on a bad shape, 409 `stale`
 * on a version mismatch, `version: ''` creates the file). The on-disk format is documented in `json/mapStore.ts`.
 */
export const registerMapRoutes = ({ router, project, bus, stories, storyId }: TServerContext) => {
    router
        .handle('getMap', async ({ params }) =>
            readMap(project, params.mapId, (await stories.read(storyId).catch(() => null))?.mapSize)
        )
        .handle('updateMap', ({ params, body }) => updateMap({ project, bus }, params.mapId, body));
};
