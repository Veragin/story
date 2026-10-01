import type { TServerContext } from '../context';
import { readChapterPassages, readPassage } from '../project/readers/passages';
import { SourceProject } from '../project/SourceProject';
import { createPassage, deletePassage, updatePassage } from '../project/writers/passages';

export const registerPassageRoutes = ({ router, project, bus }: TServerContext) => {
    const sp = SourceProject.for(project);
    const w = { sp, bus };
    router
        .handle('listChapterPassages', ({ params }) => sp.run(() => readChapterPassages(sp, params.chapterId)))
        .handle('createPassage', ({ params, body }) => createPassage(w, params.chapterId, body))
        .handle('getPassage', ({ params }) => sp.run(() => readPassage(sp, params.passageId)))
        .handle('updatePassage', ({ params, body }) => updatePassage(w, params.passageId, body))
        .handle('deletePassage', ({ params, body }) => deletePassage(w, params.passageId, body));
};
