import type { TServerContext } from '../context';
import { notImplemented } from './stub';

/**
 * Layouts: `/api/layout/timeline`, `/api/layout/chapters/:chapterId` (`*.layout.json`). Use `json/jsonStore.ts`.
 *
 * WP1 skeleton: every route answers 501. WP2 replaces each `notImplemented(...)` with a handler
 * built on `project/readers`, `project/writers` and `bus.transaction`.
 */
export const registerLayoutRoutes = ({ router }: TServerContext) => {
    router
        .handle('getTimelineLayout', notImplemented('getTimelineLayout'))
        .handle('updateTimelineLayout', notImplemented('updateTimelineLayout'))
        .handle('getChapterLayout', notImplemented('getChapterLayout'))
        .handle('updateChapterLayout', notImplemented('updateChapterLayout'));
};
