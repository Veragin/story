import type { TServerContext } from '../context';
import { notImplemented } from './stub';

/**
 * Chapters and a chapter's characters: `/api/chapters`, `/api/chapters/:chapterId[/open|/characters[/:characterId]]`.
 *
 * WP1 skeleton: every route answers 501. WP2 replaces each `notImplemented(...)` with a handler
 * built on `project/readers`, `project/writers` and `bus.transaction`.
 */
export const registerChapterRoutes = ({ router }: TServerContext) => {
    router
        .handle('createChapter', notImplemented('createChapter'))
        .handle('getChapter', notImplemented('getChapter'))
        .handle('updateChapter', notImplemented('updateChapter'))
        .handle('deleteChapter', notImplemented('deleteChapter'))
        .handle('openChapter', notImplemented('openChapter'))
        .handle('addChapterCharacter', notImplemented('addChapterCharacter'))
        .handle('removeChapterCharacter', notImplemented('removeChapterCharacter'));
};
