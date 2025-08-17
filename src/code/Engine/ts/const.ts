import { TCharacterId, TChapterId, TChapterPassageId } from 'types/TIds';
import { TChapterPassage, TPassageScreen } from 'types/TPassage';

export const DUMMY_PASSAGE: TChapterPassage<'village'> = {
    id: 'forest',
    body: [],
    characterId: 'thomas',
    chapterId: 'village',
    image: 'forest',
    title: 'Forest',
    type: 'screen',
};

export type TUnkownPassageScreen = TPassageScreen<TChapterId, TCharacterId, TChapterPassageId<TChapterId>>;
