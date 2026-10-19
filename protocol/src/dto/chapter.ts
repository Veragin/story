import type { TMaybeCode, TSourceRef, TTimeRangeDto, TValueRecord, TVersioned, TVersionedBody } from './common';
import type { TFieldDesc } from './structure';

export type TChapterDto = TVersioned &
    TSourceRef & {
        chapterId: string;
        title: TMaybeCode<string>;
        description: TMaybeCode<string>;
        timeRange: TMaybeCode<TTimeRangeDto>;
        /** A `TLocationId`. */
        location: TMaybeCode<string>;
        children: TMaybeCode<TChapterChildDto[]>;
        /** In source order; entries that are not a reference to a trigger declaration are `TCode`. */
        triggerIds: TMaybeCode<string>[];
        init: TMaybeCode<TValueRecord>;
        dataType?: TDataTypeDto;
        /** Derived from the `<characterId>.passages/` folders; ignored on PUT. */
        characters: TChapterCharacterDto[];
    };

export type TChapterChildDto = {
    condition: TMaybeCode<string>;
    /** Resolved from the source's chapter reference (`villageChapter`). */
    chapterId: TMaybeCode<string>;
};

export type TChapterCharacterDto = {
    characterId: string;
    passageCount: number;
    /** Sorted. */
    passageIds: string[];
};

/** An exported type alias next to an entity (`export type TThomasCharacterData = { … }`). */
export type TDataTypeDto = {
    name: string;
    /** The right-hand side, verbatim. In a body it is written as is, unless `fields` is given. */
    code: string;
    /**
     * When the right-hand side is an object type. In a body it takes precedence over `code`: the server writes the
     * text and adds `import type` for the literals and ids it names.
     */
    fields?: TFieldDesc[];
};

export type TChapterEditable = Pick<
    TChapterDto,
    'title' | 'description' | 'timeRange' | 'location' | 'children' | 'triggerIds' | 'init' | 'dataType'
>;

export type TCreateChapterBody = {
    chapterId: string;
    title: string;
    description?: string;
    location: string;
    timeRange: { start: string; end: string };
};

/** Omitted fields are left untouched. */
export type TUpdateChapterBody = TVersionedBody & Partial<TChapterEditable>;

export type TDeleteChapterBody = TVersionedBody;

/** Creates `<characterId>.passages/` with a start passage. */
export type TAddChapterCharacterBody = {
    characterId: string;
    /** Defaults to `intro`. */
    startPassageLocalId?: string;
};

/** `version` is the chapter's version. */
export type TRemoveChapterCharacterBody = TVersionedBody;
