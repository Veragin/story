import { TCharacterId, TChapterId, TPassageId } from 'types/TIds';

export const parsePassageId = (passageId: TPassageId) => {
    const [chapterId, characterId, ...rest] = passageId.split('-');
    return { chapterId, characterId, id: rest.join('-') } as {
        chapterId: TChapterId;
        characterId: TCharacterId;
        id: string;
    };
};
