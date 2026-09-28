import { TChapterId, TChapterPassage, TChapterPassageId, TCharacterId, TPassageScreen } from '@story/types';

export const createDummyPassage = (chapterId: TChapterId, characterId: TCharacterId): TChapterPassage<TChapterId> => ({
    id: '' as TChapterPassageId<TChapterId>,
    body: [],
    characterId,
    chapterId,
    image: '',
    title: '',
    type: 'screen',
});

export type TUnkownPassageScreen = TPassageScreen<TChapterId, TCharacterId, TChapterPassageId<TChapterId>>;
