import type { TMaybeCode, TTimeRangeDto, TVersioned } from './common';

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
    /** A display string: the literal argument of `_()` when the source title is code, else the id. */
    name: string;
};

export type TProjectChapterDto = TProjectEntryDto & {
    timeRange: TMaybeCode<TTimeRangeDto>;
    characterIds: string[];
    childIds: string[];
    triggerIds: string[];
};

export type THealthDto = {
    ok: true;
    /** `@story/server` is the NestJS server that replaces `@story/visualizer-server`. */
    service: '@story/visualizer-server' | '@story/server';
    /** Absolute path of `STORIES_ROOT`. */
    storiesRoot: string;
    watching: boolean;
    /** `@story/server` only: the database answered a ping (otherwise the response is 503). */
    database?: 'up';
};
