import type { TMaybeCode, TSourceRef, TTimeRangeDto, TValueRecord, TVersioned, TVersionedBody } from './common';

/**
 * A chapter — `data/chapters/<chapterId>/<chapterId>.chapter.ts`, typed `TChapter<E>`
 * (`types/TChapter.ts`).
 */
export type TChapterDto = TVersioned &
    TSourceRef & {
        chapterId: string;
        title: TMaybeCode<string>;
        description: TMaybeCode<string>;
        timeRange: TMaybeCode<TTimeRangeDto>;
        /** A `TLocationId`. */
        location: TMaybeCode<string>;
        /** `children: { condition, chapter }[]`; `chapter` is an identifier resolved to its chapter id. */
        children: TMaybeCode<TChapterChildDto[]>;
        /**
         * Ids of the triggers in `triggers: [...]`, in source order. The triggers themselves are
         * separate resources (`/api/triggers/:triggerId`). Entries that are not a reference to a
         * trigger declaration come back as `TCode`.
         */
        triggerIds: TMaybeCode<string>[];
        /** `init` — the chapter's slice of the world state (`T<Ch>ChapterData`). */
        init: TMaybeCode<TValueRecord>;
        /** The `T<Ch>ChapterData` type declared next to the chapter, as source text. */
        dataType?: TDataTypeDto;

        /**
         * Derived, read-only: the characters that have a `<characterId>.passages/` folder in the
         * chapter folder (plan §1.1), with how many passages each one has. Ignored on PUT.
         */
        characters: TChapterCharacterDto[];
    };

export type TChapterChildDto = {
    /** In the source this is a plain string today (`condition: 'asdasd'`). */
    condition: TMaybeCode<string>;
    /** The child chapter id (source: a reference such as `villageChapter`). */
    chapterId: TMaybeCode<string>;
};

export type TChapterCharacterDto = {
    characterId: string;
    passageCount: number;
    /** Full passage ids of the passages in the folder, sorted. */
    passageIds: string[];
};

/** An exported type alias next to an entity (`export type TThomasCharacterData = { … }`). */
export type TDataTypeDto = {
    /** `TThomasCharacterData` */
    name: string;
    /** The type's right-hand side, verbatim: `{ knowsMagic: boolean; }` */
    code: string;
};

/** Editable fields of a chapter — everything but the id, the derived fields and the source ref. */
export type TChapterEditable = Pick<
    TChapterDto,
    'title' | 'description' | 'timeRange' | 'location' | 'children' | 'triggerIds' | 'init' | 'dataType'
>;

/** `POST /api/chapters` */
export type TCreateChapterBody = {
    chapterId: string;
    title: string;
    description?: string;
    location: string;
    timeRange: { start: string; end: string };
};

/** `PUT /api/chapters/:chapterId` — omitted fields are left untouched. */
export type TUpdateChapterBody = TVersionedBody & Partial<TChapterEditable>;

/** `DELETE /api/chapters/:chapterId` */
export type TDeleteChapterBody = TVersionedBody;

/** `POST /api/chapters/:chapterId/characters` — creates `<characterId>.passages/` with a start passage. */
export type TAddChapterCharacterBody = {
    characterId: string;
    /** Local id of the start passage; defaults to `intro`. */
    startPassageLocalId?: string;
};

/**
 * `DELETE /api/chapters/:chapterId/characters/:characterId` — deletes the folder and its id union
 * and Record entries. `version` is the chapter's version.
 */
export type TRemoveChapterCharacterBody = TVersionedBody;
