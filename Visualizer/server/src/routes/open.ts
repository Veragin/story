import type { TServerContext } from '../context';
import { openInEditor, resolveChapterFile, resolvePassageFile } from '../open';

/**
 * "Open in editor": `POST /api/chapters/:chapterId/open`, `POST /api/passages/:passageId/open`
 * (see `src/open.ts`). Registered after `chapters.ts` / `passages.ts`, so these handlers replace
 * the 501 stubs there; they need no ts-morph, only the path convention.
 */
export const registerOpenRoutes = ({ router, project }: TServerContext) => {
    router
        .handle('openChapter', async ({ params }) =>
            openInEditor(project, await resolveChapterFile(project, params.chapterId))
        )
        .handle('openPassage', async ({ params }) =>
            openInEditor(project, await resolvePassageFile(project, params.passageId))
        );
};
