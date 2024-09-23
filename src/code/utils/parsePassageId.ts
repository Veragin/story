import { TCharacterId, TEventId } from 'types/TIds';

export const parsePassageId = (passageId: `${TEventId}-${TCharacterId}-${string}`) => {
    const [eventId, characterId, ...rest] = passageId.split('-');
    return { eventId, characterId, id: rest.join('-') } as {
        eventId: TEventId;
        characterId: TCharacterId;
        id: string;
    };
};
