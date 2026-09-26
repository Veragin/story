import type { TServerContext } from '../context';
import { notImplemented } from './stub';

/**
 * Passages: `/api/chapters/:chapterId/passages`, `/api/passages/:passageId[/open]`.
 *
 * WP1 skeleton: every route answers 501. WP2 replaces each `notImplemented(...)` with a handler
 * built on `project/readers`, `project/writers` and `bus.transaction`.
 */
export const registerPassageRoutes = ({ router }: TServerContext) => {
    router
        .handle('listChapterPassages', notImplemented('listChapterPassages'))
        .handle('createPassage', notImplemented('createPassage'))
        .handle('getPassage', notImplemented('getPassage'))
        .handle('updatePassage', notImplemented('updatePassage'))
        .handle('deletePassage', notImplemented('deletePassage'))
        .handle('openPassage', notImplemented('openPassage'));
};
