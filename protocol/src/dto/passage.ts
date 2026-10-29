import type { TDeltaTimeDto, TFunctionDto, TMaybeCode, TSourceRef, TVersioned, TVersionedBody } from './common';

export type TPassageType = 'start' | 'screen' | 'linear' | 'redirect' | 'finish';

type TPassageBaseDto = TVersioned &
    TSourceRef & {
        /** `<chapterId>-<characterId>-<localId>`. */
        passageId: string;
        chapterId: string;
        characterId: string;
        localId: string;
        /** Parameters the passage function declares, e.g. `['s', 'e']`. */
        params: string[];
        /** Statements before the `return` of a block-bodied passage function, verbatim; read-only. */
        preamble?: string;
        execute?: TFunctionDto;
    };

export type TScreenPassageDto = TPassageBaseDto & {
    type: 'screen';
    title: TMaybeCode<string>;
    /** A text description of the art (`''` for none); the picture is the sibling `.png`. */
    image: TMaybeCode<string>;
    body: TMaybeCode<TBodyItemDto[]>;
};

export type TLinearPassageDto = TPassageBaseDto & {
    type: 'linear';
    description: TMaybeCode<string>;
    nextPassageId?: TMaybeCode<string>;
};

/** The chapter's entry point; shaped like a linear passage. */
export type TStartPassageDto = Omit<TLinearPassageDto, 'type'> & {
    type: 'start';
};

export type TRedirectPassageDto = TPassageBaseDto & {
    type: 'redirect';
    body: TMaybeCode<TRedirectItemDto[]>;
};

export type TFinishPassageDto = TPassageBaseDto & {
    type: 'finish';
    /** A full passage id in another chapter, for the same character. */
    nextPassageId: TMaybeCode<string>;
};

export type TPassageDto =
    | TStartPassageDto
    | TScreenPassageDto
    | TLinearPassageDto
    | TRedirectPassageDto
    | TFinishPassageDto;

/** Linear-shaped passages: a description, then an optional next passage. */
export type TDescribedPassageDto = TStartPassageDto | TLinearPassageDto;

export type TBodyItemDto = {
    /** An expression, not a function; a literal `true` reads as `{ code: 'true' }`. */
    condition?: TFunctionDto;
    text?: TMaybeCode<string>;
    links?: TMaybeCode<TLinkDto[]>;
};

export type TRedirectItemDto = {
    /** An expression, not a function; the first item whose condition holds wins. */
    condition?: TFunctionDto;
    /** Full passage id. */
    redirect: TMaybeCode<string>;
};

export type TLinkDto = {
    text: TMaybeCode<string>;
    /** Full passage id. */
    passageId: TMaybeCode<string>;
    /** Spelled as in `types/TPassage.ts` (sic). */
    autoPriortiy?: TMaybeCode<number>;
    cost?: TMaybeCode<TLinkCostDto>;
    onFinish?: TFunctionDto;
};

/** Tell the variants apart with `isDeltaTime`. */
export type TLinkCostDto = TDeltaTimeDto | TLinkCostObjectDto;

export type TLinkCostObjectDto = {
    time?: TMaybeCode<TDeltaTimeDto>;
    items?: TMaybeCode<{ id: string; amount: number }[]>;
    /** Item ids. */
    tools?: TMaybeCode<string[]>;
};

/** Every string literal in a `passageId`, `redirect` or `nextPassageId` position, code fields included. */
export type TPassageEdgeDto = {
    from: string;
    to: string;
    kind: 'link' | 'redirect' | 'next';
    /** Found inside a code expression rather than a plain literal. */
    conditional: boolean;
    /** `to` exists; dangling links are still reported. */
    resolved: boolean;
};

export type TChapterPassagesDto = {
    chapterId: string;
    passages: TPassageDto[];
    edges: TPassageEdgeDto[];
};

export type TPassageEditable =
    | Partial<Pick<TScreenPassageDto, 'execute' | 'title' | 'image' | 'body'>>
    | Partial<Pick<TDescribedPassageDto, 'execute' | 'description' | 'nextPassageId'>>
    | Partial<Pick<TRedirectPassageDto, 'execute' | 'body'>>
    | Partial<Pick<TFinishPassageDto, 'execute' | 'nextPassageId'>>;

export type TCreatePassageBody = {
    characterId: string;
    localId: string;
    type: TPassageType;
    title?: string;
};

/** Omitted fields are left untouched. */
export type TUpdatePassageBody = TVersionedBody & TPassageEditable;

export type TDeletePassageBody = TVersionedBody;
