
import { TCharacterId } from 'types/TIds';
import { THistoryItem } from 'code/Engine/ts/History';

export type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;
    currentHistory: Partial<Record<TCharacterId, THistoryItem>>;

    characters: {
    };
    sideCharacters: {
    };
    events: {
    };
    locations: {
    };
};