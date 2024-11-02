// @ts-ignore
import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { TVillageThomasPassageId } from '../village.passages';

const coolPassage = (): TPassage<'village', 'thomas', TVillageThomasPassageId> => ({
    eventId: 'village',
    characterId: 'thomas',
    id: 'cool',
    type: 'transition',
    nextPassageId: 'village-thomas-',
});

export default coolPassage;
    