import type { TRouteName } from '@story/visualizer-protocol';
import { HttpError } from '../http/HttpError';
import type { TRouteHandler } from '../http/router';

/**
 * Placeholder handler for a protocol route whose implementation is WP2's: answers
 * `501 { error: 'not_implemented' }`. Replace `notImplemented('x')` with the real handler.
 */
export const notImplemented =
    <R extends TRouteName>(route: R): TRouteHandler<R> =>
    () => {
        throw HttpError.notImplemented(`${route} is not implemented yet (plan WP2)`);
    };
