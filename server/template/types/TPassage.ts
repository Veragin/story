import type {
    TLink as TEngineLink,
    TLinkCost as TEngineLinkCost,
    TPassage as TEnginePassage,
    TPassageFinish as TEnginePassageFinish,
    TPassageId,
    TPassageLinear as TEnginePassageLinear,
    TPassageRedirect as TEnginePassageRedirect,
    TPassageScreen as TEnginePassageScreen,
    TPassageStart as TEnginePassageStart,
} from '@story/shared';
import { TCharacterId, TChapterCharacterPassageId, TChapterId, TChapterPassageId } from './ids';
import { TItemId } from './TItem';

export type TChapterPassage<E extends TChapterId> = TPassage<E, TCharacterId, TChapterPassageId<E>>;

export type TPassage<
    E extends TChapterId,
    Ch extends TCharacterId,
    Ids extends TChapterCharacterPassageId<E, Ch>,
> = TEnginePassage<E, Ch, Ids, TChapterCharacterPassageId<TChapterId, Ch>, TItemId>;

export type TPassageStart<
    E extends TChapterId,
    Ch extends TCharacterId,
    Ids extends TChapterCharacterPassageId<E, Ch>,
> = TEnginePassageStart<E, Ch, Ids>;

export type TPassageScreen<
    E extends TChapterId,
    Ch extends TCharacterId,
    Ids extends TChapterCharacterPassageId<E, Ch>,
> = TEnginePassageScreen<E, Ch, Ids, TItemId>;

export type TPassageLinear<
    E extends TChapterId,
    Ch extends TCharacterId,
    Ids extends TChapterCharacterPassageId<E, Ch>,
> = TEnginePassageLinear<E, Ch, Ids>;

export type TPassageRedirect<
    E extends TChapterId,
    Ch extends TCharacterId,
    Ids extends TChapterCharacterPassageId<E, Ch>,
> = TEnginePassageRedirect<E, Ch, Ids>;

export type TPassageFinish<E extends TChapterId, Ch extends TCharacterId> = TEnginePassageFinish<
    E,
    Ch,
    TChapterCharacterPassageId<TChapterId, Ch>
>;

export type TLink<Ids extends TPassageId> = TEngineLink<Ids, TItemId>;

export type TLinkCost = TEngineLinkCost<TItemId>;

export type TChapterPassageType = TChapterPassage<TChapterId>['type'];

export const getWholePassageId = <E extends TChapterId, Ch extends TCharacterId>(
    passage: TChapterPassage<E>
): TChapterCharacterPassageId<E, Ch> => {
    return `${passage.chapterId}-${passage.characterId}-${passage.id}` as TChapterCharacterPassageId<E, Ch>;
};
