import type { TServerContext } from '../context';
import { notImplemented } from './stub';

/**
 * Time triggers: `/api/chapters/:chapterId/triggers`, `/api/triggers/:triggerId`.
 *
 * WP1 skeleton: every route answers 501. WP2 replaces each `notImplemented(...)` with a handler
 * built on `project/readers`, `project/writers` and `bus.transaction`.
 */
export const registerTriggerRoutes = ({ router }: TServerContext) => {
    router
        .handle('createTrigger', notImplemented('createTrigger'))
        .handle('getTrigger', notImplemented('getTrigger'))
        .handle('updateTrigger', notImplemented('updateTrigger'))
        .handle('deleteTrigger', notImplemented('deleteTrigger'));
};
