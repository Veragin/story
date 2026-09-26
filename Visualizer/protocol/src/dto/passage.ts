import type { TCode, TDeltaTimeDto, TMaybeCode, TSourceRef, TVersioned, TVersionedBody } from './common';

/**
 * A passage — `data/chapters/<ch>/<character>.passages/<local>[.<suffix>].ts`, one exported
 * function `(s?, e?) => TPassage<…>` per file (`types/TPassage.ts`). The reader finds the object
 * literal the function returns (arrow expression body *or* the `return` of a block body) and
 * reads its properties; everything outside that object (the statements before `return`, the
 * parameters) is preserved by writers and exposed read-only as `preamble`.
 */
export type TPassageType = 'screen' | 'linear' | 'transition';

type TPassageBaseDto = TVersioned &
    TSourceRef & {
        /** Full id, `<chapterId>-<characterId>-<localId>` — the key in `<ch>.passages.ts`. */
        passageId: string;
        chapterId: string;
        characterId: string;
        /** The passage's own `id` field (`'intro'`). */
        localId: string;
        /** Parameters the passage function declares, e.g. `['s']` or `['s', 'e']`. */
        params: string[];
        /** Statements before the `return` of a block-bodied passage function, verbatim. */
        preamble?: string;
    };

export type TScreenPassageDto = TPassageBaseDto & {
    type: 'screen';
    title: TMaybeCode<string>;
    /** An asset key (`'hunter'`), see `data/assets`. */
    image: TMaybeCode<string>;
    body: TMaybeCode<TBodyItemDto[]>;
};

export type TLinearPassageDto = TPassageBaseDto & {
    type: 'linear';
    description: TMaybeCode<string>;
    nextPassageId?: TMaybeCode<string>;
};

export type TTransitionPassageDto = TPassageBaseDto & {
    type: 'transition';
    /** A full passage id in *another* chapter, for the same character. */
    nextPassageId: TMaybeCode<string>;
};

export type TPassageDto = TScreenPassageDto | TLinearPassageDto | TTransitionPassageDto;

export type TBodyItemDto = {
    condition?: TMaybeCode<boolean>;
    /** Full passage id. */
    redirect?: TMaybeCode<string>;
    text?: TMaybeCode<string>;
    links?: TMaybeCode<TLinkDto[]>;
};

export type TLinkDto = {
    text: TMaybeCode<string>;
    /** Full passage id. */
    passageId: TMaybeCode<string>;
    /** Spelled as in `types/TPassage.ts` (sic). */
    autoPriortiy?: TMaybeCode<number>;
    cost?: TMaybeCode<TLinkCostDto>;
    /** Always code: a function. */
    onFinish?: TCode;
};

/** `TLinkCost = DeltaTime | { time?, items?, tools? }` — tell them apart with `isDeltaTime`. */
export type TLinkCostDto = TDeltaTimeDto | TLinkCostObjectDto;

export type TLinkCostObjectDto = {
    time?: TMaybeCode<TDeltaTimeDto>;
    items?: TMaybeCode<{ id: string; amount: number }[]>;
    /** Item ids. */
    tools?: TMaybeCode<string[]>;
};

/**
 * A statically extracted edge of the passage graph (plan §1.1 "Source of truth"): every string
 * literal in a `passageId`, `redirect` or `nextPassageId` position, *including* ones inside code
 * fields (conditional links still show up, with `conditional: true`).
 */
export type TPassageEdgeDto = {
    from: string;
    to: string;
    kind: 'link' | 'redirect' | 'next';
    /** True when the target was found inside a code expression rather than a plain literal. */
    conditional: boolean;
    /** Whether `to` is a passage that exists (a dangling link is still reported). */
    resolved: boolean;
};

/** `GET /api/chapters/:chapterId/passages` */
export type TChapterPassagesDto = {
    chapterId: string;
    /** Every passage of every character folder in the chapter. */
    passages: TPassageDto[];
    edges: TPassageEdgeDto[];
};

/** Editable fields per passage type (ids, type and source ref are read-only in v1). */
export type TPassageEditable =
    | Partial<Pick<TScreenPassageDto, 'title' | 'image' | 'body'>>
    | Partial<Pick<TLinearPassageDto, 'description' | 'nextPassageId'>>
    | Partial<Pick<TTransitionPassageDto, 'nextPassageId'>>;

/** `POST /api/chapters/:chapterId/passages` */
export type TCreatePassageBody = {
    characterId: string;
    localId: string;
    type: TPassageType;
    title?: string;
};

/** `PUT /api/passages/:passageId` — omitted fields are left untouched. */
export type TUpdatePassageBody = TVersionedBody & TPassageEditable;

/** `DELETE /api/passages/:passageId` */
export type TDeletePassageBody = TVersionedBody;
