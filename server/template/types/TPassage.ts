import { TCharacterId, TChapterCharacterPassageId, TChapterId, TChapterPassageId } from './ids';
import { DeltaTime, TPassageId } from '@story/shared';
import { TItemId } from './TItem';

export type TChapterPassage<E extends TChapterId> = TPassage<E, TCharacterId, TChapterPassageId<E>>;

export type TPassage<E extends TChapterId, Ch extends TCharacterId, Ids extends TChapterCharacterPassageId<E, Ch>> =
    | TPassageStart<E, Ch, Ids>
    | TPassageScreen<E, Ch, Ids>
    | TPassageLinear<E, Ch, Ids>
    | TPassageRedirect<E, Ch, Ids>
    | TPassageFinish<E, Ch>;

export type TPassageScreen<
    E extends TChapterId,
    Ch extends TCharacterId,
    Ids extends TChapterCharacterPassageId<E, Ch>,
> = {
    chapterId: E;
    characterId: Ch;
    id: string;

    /**
     * Runs once when the passage is entered, after its fields were evaluated: `condition`,
     * texts and costs reflect the state on entry, not the state after `execute` (D2). Link
     * `onFinish` callbacks and the next passage see its effects.
     */
    execute?: () => void;

    title: string;
    image: string;
    type: 'screen';
    body: {
        condition?: boolean;
        text?: string;
        links?: TLink<Ids>[];
    }[];
};

export type TLink<Ids extends TPassageId> = {
    text: string;
    passageId: Ids;
    autoPriortiy?: number;
    cost?: TLinkCost;

    onFinish?: () => void;
};

export type TLinkCost =
    | DeltaTime
    | {
          time?: DeltaTime;
          items?: { id: TItemId; amount: number }[];
          tools?: TItemId[];
      };

export type TPassageFinish<E extends TChapterId, Ch extends TCharacterId> = {
    chapterId: E;
    characterId: Ch;
    id: string;
    /**
     * Runs once when the passage is entered, after its fields were evaluated: `condition`,
     * texts and costs reflect the state on entry, not the state after `execute` (D2). Link
     * `onFinish` callbacks and the next passage see its effects.
     */
    execute?: () => void;
    type: 'finish';
    nextPassageId: TChapterCharacterPassageId<TChapterId, Ch>;
};

export type TPassageStart<
    E extends TChapterId,
    Ch extends TCharacterId,
    Ids extends TChapterCharacterPassageId<E, Ch>,
> = {
    chapterId: E;
    characterId: Ch;
    id: string;
    /**
     * Runs once when the passage is entered, after its fields were evaluated: `condition`,
     * texts and costs reflect the state on entry, not the state after `execute` (D2). Link
     * `onFinish` callbacks and the next passage see its effects.
     */
    execute?: () => void;
    type: 'start';
    description: string;
    nextPassageId?: Ids & TChapterCharacterPassageId<E, Ch>;
};

export type TPassageLinear<
    E extends TChapterId,
    Ch extends TCharacterId,
    Ids extends TChapterCharacterPassageId<E, Ch>,
> = {
    chapterId: E;
    characterId: Ch;
    id: string;
    /**
     * Runs once when the passage is entered, after its fields were evaluated: `condition`,
     * texts and costs reflect the state on entry, not the state after `execute` (D2). Link
     * `onFinish` callbacks and the next passage see its effects.
     */
    execute?: () => void;
    type: 'linear';
    description: string;
    nextPassageId?: Ids & TChapterCharacterPassageId<E, Ch>;
};

export type TPassageRedirect<
    E extends TChapterId,
    Ch extends TCharacterId,
    Ids extends TChapterCharacterPassageId<E, Ch>,
> = {
    chapterId: E;
    characterId: Ch;
    id: string;
    /**
     * Runs once when the passage is entered, after its fields were evaluated: `condition`,
     * texts and costs reflect the state on entry, not the state after `execute` (D2). Link
     * `onFinish` callbacks and the next passage see its effects.
     */
    execute?: () => void;
    type: 'redirect';
    body: {
        condition?: boolean;
        redirect: Ids;
    }[];
};

export type TChapterPassageType = TChapterPassage<TChapterId>['type'];

export const getWholePassageId = <E extends TChapterId, Ch extends TCharacterId>(
    passage: TChapterPassage<E>
): TChapterCharacterPassageId<E, Ch> => {
    return `${passage.chapterId}-${passage.characterId}-${passage.id}` as TChapterCharacterPassageId<E, Ch>;
};
