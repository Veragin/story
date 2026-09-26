import type { TServerContext } from '../context';
import { readChapterLayout, readTimelineLayout, updateChapterLayout, updateTimelineLayout } from '../json/layoutStore';

/**
 * Layouts: `/api/layout/timeline` (`data/chapters/timeline.layout.json`) and
 * `/api/layout/chapters/:chapterId` (`data/chapters/<ch>/<ch>.layout.json`, 404 when the chapter
 * folder does not exist). A missing file reads as the empty layout with `version: ''`; `PUT` is a
 * validated whole-document replace, like the map (see `json/layoutStore.ts`).
 */
export const registerLayoutRoutes = ({ router, project, bus }: TServerContext) => {
    router
        .handle('getTimelineLayout', () => readTimelineLayout(project))
        .handle('updateTimelineLayout', ({ body }) => updateTimelineLayout({ project, bus }, body))
        .handle('getChapterLayout', ({ params }) => readChapterLayout(project, params.chapterId))
        .handle('updateChapterLayout', ({ params, body }) =>
            updateChapterLayout({ project, bus }, params.chapterId, body)
        );
};
