import { TCharacterId, TChapterCharacterPassageId, TChapterId, TChapterPassageId, TPassageId } from './TIds';
import { TItemId } from './TItem';

export type TChapterPassage<E extends TChapterId> = TPassage<E, TCharacterId, TChapterPassageId<E>>;

export type TPassage<E extends TChapterId, Ch extends TCharacterId, Ids extends TChapterCharacterPassageId<E, Ch>> =
    | TPassageScreen<E, Ch, Ids>
    | TPassageTransition<E, Ch>
    | TPassageLinear<E, Ch, Ids>;

export type TPassageScreen<E extends TChapterId, Ch extends TCharacterId, Ids extends TChapterCharacterPassageId<E, Ch>> = {
    chapterId: E;
    characterId: Ch;
    id: string;

    title: string;
    image: string;
    type: 'screen';
    body: {
        condition?: boolean;
        redirect?: Ids;
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

export type TPassageTransition<E extends TChapterId, Ch extends TCharacterId> = {
    chapterId: E;
    characterId: Ch;
    id: string;
    type: 'transition';
    nextPassageId: TChapterCharacterPassageId<TChapterId, Ch>;
};

export type TPassageLinear<E extends TChapterId, Ch extends TCharacterId, Ids extends TChapterCharacterPassageId<E, Ch>> = {
    chapterId: E;
    characterId: Ch;
    id: string;
    type: 'linear';
    description: string;
    nextPassageId?: Ids & TChapterCharacterPassageId<E, Ch>;
};

export type TChapterPassageType = TChapterPassage<TChapterId>['type'];

export const getWholePassageId = <E extends TChapterId, Ch extends TCharacterId>(
        passage: TChapterPassage<E>
    ): TChapterCharacterPassageId<E, Ch> => {
    return `${passage.chapterId}-${passage.characterId}-${passage.id}` as TChapterCharacterPassageId<E, Ch>;
};
