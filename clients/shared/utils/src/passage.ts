import type { TPassageId, TPassageIdFor } from './ids';
import type { DeltaTime } from './time/Time';
import { isOneOf } from './typeguards';

export const PASSAGE_TYPES = ['start', 'screen', 'linear', 'redirect', 'finish'] as const;

export type TPassageType = (typeof PASSAGE_TYPES)[number];

export const isPassageType = (value: unknown): value is TPassageType => isOneOf(value, PASSAGE_TYPES);

type TPassageBase<E extends string, Ch extends string> = {
    chapterId: E;
    characterId: Ch;
    id: string;

    /**
     * Runs once when the passage is entered, after its fields were evaluated: `condition`,
     * texts and costs reflect the state on entry, not the state after `execute` (D2). Link
     * `onFinish` callbacks and the next passage see its effects.
     */
    execute?: () => void;
};

export type TLinkCost<I extends string> =
    | DeltaTime
    | {
          time?: DeltaTime;
          items?: { id: I; amount: number }[];
          tools?: I[];
      };

export type TLink<Ids extends TPassageId, I extends string> = {
    text: string;
    passageId: Ids;
    autoPriortiy?: number;
    cost?: TLinkCost<I>;

    onFinish?: () => void;
};

export type TPassageStart<E extends string, Ch extends string, Ids extends TPassageIdFor<E, Ch>> = TPassageBase<
    E,
    Ch
> & {
    type: 'start';
    description: string;
    nextPassageId?: Ids & TPassageIdFor<E, Ch>;
};

export type TPassageScreen<
    E extends string,
    Ch extends string,
    Ids extends TPassageIdFor<E, Ch>,
    I extends string,
> = TPassageBase<E, Ch> & {
    type: 'screen';
    title: string;
    image: string;
    body: {
        condition?: boolean;
        text?: string;
        links?: TLink<Ids, I>[];
    }[];
};

export type TPassageLinear<E extends string, Ch extends string, Ids extends TPassageIdFor<E, Ch>> = TPassageBase<
    E,
    Ch
> & {
    type: 'linear';
    description: string;
    nextPassageId?: Ids & TPassageIdFor<E, Ch>;
};

export type TPassageRedirect<E extends string, Ch extends string, Ids extends TPassageIdFor<E, Ch>> = TPassageBase<
    E,
    Ch
> & {
    type: 'redirect';
    body: {
        condition?: boolean;
        redirect: Ids;
    }[];
};

/** `Next` is a passage of the same character in any chapter, typically the next chapter's. */
export type TPassageFinish<E extends string, Ch extends string, Next extends TPassageIdFor<string, Ch>> = TPassageBase<
    E,
    Ch
> & {
    type: 'finish';
    nextPassageId: Next;
};

export type TPassage<
    E extends string,
    Ch extends string,
    Ids extends TPassageIdFor<E, Ch>,
    Next extends TPassageIdFor<string, Ch>,
    I extends string,
> =
    | TPassageStart<E, Ch, Ids>
    | TPassageScreen<E, Ch, Ids, I>
    | TPassageLinear<E, Ch, Ids>
    | TPassageRedirect<E, Ch, Ids>
    | TPassageFinish<E, Ch, Next>;
