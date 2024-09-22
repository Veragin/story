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
            this.data[char] = [];
        });
    }

    addTurn = (turn: THistoryItem) => {
        const { characterId } = parsePassageId(turn.passageId);
        this.data[characterId]?.push(turn);
    };

    getTurn = (): THistoryItem => {
        let minHistory = {
            passageId: register.characters[this.s.mainCharacterId].startPassageId,
            time: Time.fromS(0),
        };

        for (const char of this.characterList) {
            if (this.s.characters[char].health <= 0) {
                continue;
            }
            const charHistory = this.data[char];
            if (!charHistory || charHistory.length === 0) {
                return {
                    passageId: register.characters[char].startPassageId,
                    time: Time.fromS(0),
                };
            }

            const lastHistory = charHistory[charHistory.length - 1];
            if (lastHistory.time.isBefore(minHistory.time)) {
                minHistory = lastHistory;
            }
        }

        return minHistory;
    };
}

export type THistoryItem = {
    passageId: TEventPassageId<TEventId>;
    time: Time;
    onStart?: () => void; // called when passage is starts
};
