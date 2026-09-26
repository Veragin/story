import type { TServerContext } from '../context';
import { notImplemented } from './stub';

/**
 * `GET /api/project`.
 *
 * WP1 skeleton: every route answers 501. WP2 replaces each `notImplemented(...)` with a handler
 * built on `project/readers`, `project/writers` and `bus.transaction`.
 */
export const registerProjectRoutes = ({ router }: TServerContext) => {
    router.handle('getProject', notImplemented('getProject'));
};
