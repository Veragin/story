import { parsePassageId } from 'code/utils/parsePassageId';
import { Time } from 'time/Time';
import { register } from 'data/register';
import { TWorldState } from 'data/TWorldState';
import { TCharacterId, TEventId, TEventPassageId } from 'types/TIds';

export class History {
    data: Partial<Record<TCharacterId, THistoryItem[]>> = {};

    private characterList = Object.keys(register.characters) as TCharacterId[];

    constructor(private s: TWorldState) {
        this.characterList.forEach((char) => {
            this.data[char] = [this.prepareHistory(char)];
        });
    }

    private prepareHistory = (char: TCharacterId) => {
        if (this.s.currentHistory[char] !== undefined) {
            return this.s.currentHistory[char];
        }

        const passageId = register.characters[char].startPassageId;
        const eventId = parsePassageId(passageId).eventId;
        const time = register.events[eventId].timeRange.start;
        return { passageId, time };
    };

    addTurn = (turn: THistoryTurnItem) => {
        const { characterId } = parsePassageId(turn.passageId);
        this.data[characterId]?.push(turn);
        this.s.currentHistory[characterId] = turn;
    };

    addEnd = (characterId: TCharacterId, reason: THistoryEndItem['reason']) => {
        this.data[characterId]?.push({
            time: Time.fromS(Infinity),
            reason,
        });
    };

    getTurn = (): THistoryTurnItem => {
        let minHistory = this.getLastHistoryItemOfCharacter(this.s.mainCharacterId);

        for (const char of this.characterList) {
            const lastHistory = this.getLastHistoryItemOfCharacter(char);

            if (lastHistory.time.isBefore(minHistory.time)) {
                minHistory = lastHistory;
            }
        }

        if (isEndHistoryItem(minHistory)) {
            throw new Error('No moves left');
        }

        return minHistory;
    };

    private getLastHistoryItemOfCharacter = (char: TCharacterId) => {
        const mainData = this.data[char]!; // initialized in constructor
        return mainData[mainData.length - 1];
    };
}

export type THistoryItem = THistoryTurnItem | THistoryEndItem;

export type THistoryTurnItem = {
    passageId: TEventPassageId<TEventId>;
    time: Time;
    onStart?: () => void; // called when passage is starts
};

type THistoryEndItem = {
    time: Time;
    reason: 'NO_ACTIONS' | 'DEAD';
};

const isEndHistoryItem = (item: THistoryItem): item is THistoryEndItem => {
    return !Number.isFinite(item.time.s);
};
