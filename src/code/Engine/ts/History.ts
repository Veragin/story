import { Time } from 'code/time/Time';
import { register } from 'data/register';
import { TWorldState } from 'data/TWorldState';
import { TPassagePt } from 'types/TCharacter';
import { TCharacterId, TEventId } from 'types/TIds';

export class History {
    data: Partial<Record<TCharacterId, THistoryItem[]>> = {};
    private characterList = Object.keys(register.characters) as TCharacterId[];

    constructor(private s: TWorldState) {
        this.characterList.forEach((char) => {
            this.data[char] = [];
        });
    }

    addTurn = (turn: THistoryItem) => {
        this.data[turn.characterId]?.push(turn);
    };

    getTurn = (): THistoryItem => {
        let minHistory = {
            ...register.characters[this.s.mainCharacterId].startPassagePt,
            time: Time.fromS(0),
        } as THistoryItem;

        for (const char of this.characterList) {
            const charHistory = this.data[char];
            if (!charHistory || charHistory.length === 0) {
                return {
                    ...register.characters[char].startPassagePt,
                    time: Time.fromS(0),
                } as THistoryItem;
            }

            const lastHistory = charHistory[charHistory.length - 1];
            if (lastHistory.time.isBefore(minHistory.time)) {
                minHistory = lastHistory;
            }
        }

        return minHistory;
    };
}

export type THistoryItem = TPassagePt<TEventId, TCharacterId> & {
    time: Time;
    onStart?: () => void; // called when passage is starts
};
