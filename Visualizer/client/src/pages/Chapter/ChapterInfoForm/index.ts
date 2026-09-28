/**
 * The reusable chapter-info form (plan WP6): `ChapterInfoForm` is the controlled form,
 * `ChapterInfoDialog` / `openChapterInfoDialog` wrap it in a modal that loads and saves one
 * chapter, `ChapterInfoEditorStore` is that modal's logic.
 */
export { ChapterInfoForm, type TChapterInfoFormProps } from './ChapterInfoForm';
export { chapterInfoOf, CHAPTER_INFO_FIELDS, type TChapterInfoValue } from './chapterInfo';
export { ChapterInfoDialog } from './ChapterInfoDialog';
export { ChapterInfoEditorStore } from './ChapterInfoEditorStore';
export { openChapterInfoDialog } from './openChapterInfoDialog';
