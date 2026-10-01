import type { TServerContext } from '../context';
import { readChapterLayout, readTimelineLayout, updateChapterLayout, updateTimelineLayout } from '../json/layoutStore';

export const registerLayoutRoutes = ({ router, project, bus }: TServerContext) => {
    router
        .handle('getTimelineLayout', () => readTimelineLayout(project))
        .handle('updateTimelineLayout', ({ body }) => updateTimelineLayout({ project, bus }, body))
        .handle('getChapterLayout', ({ params }) => readChapterLayout(project, params.chapterId))
        .handle('updateChapterLayout', ({ params, body }) =>
            updateChapterLayout({ project, bus }, params.chapterId, body)
        );
};
