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
            const passageId = register.characters[char].startPassageId;
            const eventId = parsePassageId(passageId).eventId;
            const time = register.events[eventId].timeRange.start;

            this.data[char] = [{ passageId, time }];
        });
    }

    addTurn = (turn: THistoryItem) => {
        const { characterId } = parsePassageId(turn.passageId);
        this.data[characterId]?.push(turn);
    };

    getTurn = (): THistoryItem => {
        let minHistory = this.getLastHistoryItemOfCharacter(this.s.mainCharacterId);

        for (const char of this.characterList) {
            if (this.s.characters[char].health <= 0) {
                // skip all dead characters
                continue;
            }
            const lastHistory = this.getLastHistoryItemOfCharacter(char);

            if (lastHistory.time.isBefore(minHistory.time)) {
                minHistory = lastHistory;
            }
        }

        return minHistory;
    };

    private getLastHistoryItemOfCharacter = (char: TCharacterId) => {
        const mainData = this.data[char]!; // initialized in constructor
        return mainData[mainData.length - 1];
    };
}

export type THistoryItem = {
    passageId: TEventPassageId<TEventId>;
    time: Time;
    onStart?: () => void; // called when passage is starts
};
