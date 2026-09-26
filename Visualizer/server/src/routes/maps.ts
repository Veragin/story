import type { TServerContext } from '../context';
import { notImplemented } from './stub';

/**
 * The map: `/api/maps/:mapId` (`data/locations/map.json`, only `global`). Use `json/jsonStore.ts`.
 *
 * WP1 skeleton: every route answers 501. WP2 replaces each `notImplemented(...)` with a handler
 * built on `project/readers`, `project/writers` and `bus.transaction`.
 */
export const registerMapRoutes = ({ router }: TServerContext) => {
    router.handle('getMap', notImplemented('getMap')).handle('updateMap', notImplemented('updateMap'));
};
