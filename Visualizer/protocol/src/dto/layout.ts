import type { TPoint } from '@story/shared';
import type { TVersioned, TVersionedBody } from './common';

/** x is never stored: it is the chapter's time range / the trigger's time. */
export type TTimelineLayoutFile = {
    chapters: Record<string, { y: number }>;
    triggers: Record<string, { y?: number }>;
};

export type TTimelineLayoutDto = TVersioned & TTimelineLayoutFile;

/** Whole-document replace; `version: ''` creates the file. */
export type TUpdateTimelineLayoutBody = TVersionedBody & TTimelineLayoutFile;

export type TChapterLayoutFile = {
    /** Keyed by full passage id. */
    passages: Record<string, TPoint>;
};

export type TChapterLayoutDto = TVersioned & TChapterLayoutFile & { chapterId: string };

/** Whole-document replace; `version: ''` creates the file. */
export type TUpdateChapterLayoutBody = TVersionedBody & TChapterLayoutFile;
