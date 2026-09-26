import type { TServerContext } from '../context';
import { notImplemented } from './stub';

/**
 * Characters, npcs, locations, items: `/api/entities/:kind[/:id]`.
 *
 * WP1 skeleton: every route answers 501. WP2 replaces each `notImplemented(...)` with a handler
 * built on `project/readers`, `project/writers` and `bus.transaction`.
 */
export const registerEntityRoutes = ({ router }: TServerContext) => {
    router
        .handle('listEntities', notImplemented('listEntities'))
        .handle('createEntity', notImplemented('createEntity'))
        .handle('getEntity', notImplemented('getEntity'))
        .handle('updateEntity', notImplemented('updateEntity'))
        .handle('deleteEntity', notImplemented('deleteEntity'));
};
