import { Time } from 'code/time/Time';
import { register } from 'data/register';
import { TWorldState } from 'data/TWorldState';
import { TPassagePt } from 'types/TCharacter';
import { TCharacterId, TCharacterIdInEvent, TEventId } from 'types/TIds';

export class History {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Partial<Record<TCharacterId, THistoryItem<any>[]>> = {};

    private characterList = Object.keys(register.characters) as TCharacterId[];

    constructor(private s: TWorldState) {
        this.characterList.forEach((char) => {
            this.data[char] = [];
        });
    }

    addTurn = <E extends TEventId>(turn: THistoryItem<E>) => {
        this.data[turn.passagePt.characterId]?.push(turn);
    };

    getTurn = <E extends TEventId>(): THistoryItem<E> => {
        let minHistory = {
            passagePt: register.characters[this.s.mainCharacterId].startPassagePt,
            time: Time.fromS(0),
        };

        for (const char of this.characterList) {
            if (this.s.characters[char].health <= 0) {
                continue;
            }
            const charHistory = this.data[char];
            if (!charHistory || charHistory.length === 0) {
                return {
                    passagePt: register.characters[char].startPassagePt,
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

export type THistoryItem<E extends TEventId> = {
    passagePt: TPassagePt<E, TCharacterIdInEvent<E>>;
    time: Time;
    onStart?: () => void; // called when passage is starts
};
