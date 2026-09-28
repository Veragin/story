import type { TChapterDto } from '@story/visualizer-protocol';

/** The part of a chapter the chapter-info form edits. */
export type TChapterInfoValue = Pick<TChapterDto, 'title' | 'description' | 'location' | 'timeRange' | 'children'>;

export const CHAPTER_INFO_FIELDS = ['title', 'description', 'location', 'timeRange', 'children'] as const;

export const chapterInfoOf = (c: TChapterInfoValue): TChapterInfoValue => ({
    title: c.title,
    description: c.description,
    location: c.location,
    timeRange: c.timeRange,
    children: c.children,
});
