import type { TPoint } from '@story/shared';
import type { TVersioned, TVersionedBody } from './common';

/**
 * `data/chapters/timeline.layout.json` (plan §1.1): the free y-position of each chapter box on
 * the timeline, and per-trigger view data. x is never stored — it is the chapter's time range /
 * the trigger's time.
 */
export type TTimelineLayoutFile = {
    chapters: Record<string, { y: number }>;
    triggers: Record<string, { y?: number }>;
};

export type TTimelineLayoutDto = TVersioned & TTimelineLayoutFile;

/** `PUT /api/layout/timeline` — whole-document replace; `version: ''` creates the file. */
export type TUpdateTimelineLayoutBody = TVersionedBody & TTimelineLayoutFile;

/** `data/chapters/<ch>/<ch>.layout.json`: passage box positions of the chapter view. */
export type TChapterLayoutFile = {
    /** Keyed by full passage id. */
    passages: Record<string, TPoint>;
};

export type TChapterLayoutDto = TVersioned & TChapterLayoutFile & { chapterId: string };

/** `PUT /api/layout/chapters/:chapterId` — whole-document replace; `version: ''` creates the file. */
export type TUpdateChapterLayoutBody = TVersionedBody & TChapterLayoutFile;
