import { TCharacterId, TEventId, TEventPassageId } from 'types/TIds';
import { TEventPassage, TPassageScreen } from 'types/TPassage';

export const DUMMY_PASSAGE: TEventPassage<'village'> = {
    id: 'forest',
    body: [],
    characterId: 'thomas',
    eventId: 'village',
    image: 'forest',
    title: 'Forest',
    type: 'screen',
};

export type TUnkownPassageScreen = TPassageScreen<TEventId, TCharacterId, TEventPassageId<TEventId>>;
