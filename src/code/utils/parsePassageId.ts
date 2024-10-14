import { TCharacterId, TEventId, TPassageId } from 'types/TIds';

export const parsePassageId = (passageId: TPassageId) => {
    const [eventId, characterId, ...rest] = passageId.split('-');
    return { eventId, characterId, id: rest.join('-') } as {
        eventId: TEventId;
        characterId: TCharacterId;
        id: string;
    };
};
