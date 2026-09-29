import type { TMaybeCode, TTimeRangeDto, TVersioned } from './common';

/**
 * `GET /project` — the lists behind every picker and the Timeline: ids and display names of
 * all chapters, characters, npcs, locations, items and triggers. Titles that are code in the
 * source (`_('Wedding Chapter')`) are reduced to a display string by the server (the literal
 * argument of `_()` when there is one, else the id).
 */
export type TProjectDto = TVersioned & {
    chapters: TProjectChapterDto[];
    characters: TProjectEntryDto[];
    npcs: TProjectEntryDto[];
    locations: TProjectEntryDto[];
    items: (TProjectEntryDto & { type: string })[];
    triggers: (TProjectEntryDto & { chapterId: string })[];
};

export type TProjectEntryDto = {
    id: string;
    /** Display name / title. */
    name: string;
};

export type TProjectChapterDto = TProjectEntryDto & {
    timeRange: TMaybeCode<TTimeRangeDto>;
    /** Characters with a `<characterId>.passages/` folder in the chapter (plan §1.1). */
    characterIds: string[];
    /** Child chapter ids, for the Timeline's parent → children arrows. */
    childIds: string[];
    triggerIds: string[];
};

/** `GET /api/health` */
export type THealthDto = {
    ok: true;
    service: '@story/visualizer-server';
    /** Absolute folder holding every story, `stories/<id>/` (`STORIES_ROOT`). */
    storiesRoot: string;
    /** Whether each story's file watcher (behind its `/events`) runs while the story is loaded. */
    watching: boolean;
};
