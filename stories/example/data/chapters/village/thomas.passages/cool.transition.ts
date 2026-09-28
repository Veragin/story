import { TPassage } from '@story/types';
import { TVillageThomasPassageId } from '../village.passages';

const coolPassage = (): TPassage<'village', 'thomas', TVillageThomasPassageId> => ({
    chapterId: 'village',
    characterId: 'thomas',
    id: 'cool',
    type: 'transition',
    nextPassageId: 'village-thomas-',
});

export default coolPassage;
