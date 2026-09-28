import type { TServerContext } from '../context';
import { readChapter } from '../project/readers/chapters';
import { SourceProject } from '../project/SourceProject';
import {
    addChapterCharacter,
    createChapter,
    deleteChapter,
    removeChapterCharacter,
    updateChapter,
} from '../project/writers/chapters';

/**
 * Chapters and a chapter's characters: `/api/chapters`, `/api/chapters/:chapterId[/characters[/:characterId]]`
 * (`project/readers/chapters.ts`, `project/writers/chapters.ts`). `openChapter` is registered by
 * `routes/open.ts`.
 */
export const registerChapterRoutes = ({ router, project, bus }: TServerContext) => {
    const sp = SourceProject.for(project);
    const w = { sp, bus };
    router
        .handle('createChapter', ({ body }) => createChapter(w, body))
        .handle('getChapter', ({ params }) => sp.run(() => readChapter(sp, params.chapterId)))
        .handle('updateChapter', ({ params, body }) => updateChapter(w, params.chapterId, body))
        .handle('deleteChapter', ({ params, body }) => deleteChapter(w, params.chapterId, body))
        .handle('addChapterCharacter', ({ params, body }) => addChapterCharacter(w, params.chapterId, body))
        .handle('removeChapterCharacter', ({ params, body }) =>
            removeChapterCharacter(w, params.chapterId, params.characterId, body)
        );
};
