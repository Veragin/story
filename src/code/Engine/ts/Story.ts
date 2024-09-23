import { DeltaTime } from 'time/Time';
import { TWorldState } from 'data/TWorldState';
import { TPassageId } from 'types/TIds';
import { TLinkCost } from 'types/TPassage';
import { Engine } from './Engine';
import { parsePassageId } from 'code/utils/parsePassageId';

export class Story {
    constructor(private s: TWorldState, private e: Engine) {}

    goToPassage = (passageId: TPassageId, cost: TLinkCost, cb?: () => void) => {
        const { characterId } = parsePassageId(passageId);
        const { time, items } = this.e.processor.parseCost(cost);
        this.e.history.addTurn({
            passageId,
            time: this.s.time.moveToFutureBy(time),
            onStart: cb,
        });

        items?.forEach((item) => this.e.inventory.removeItem(item), characterId);

        this.e.processor.continue();
    };

    spendTime = (time: DeltaTime) => {
        this.s.time = this.s.time.moveToFutureBy(time);
        const val = (time.hour * 50) / 16;

        if (this.e.history.data[this.s.mainCharacterId]!.length <= 1) {
            // character havent started yet
            return;
        }
        // computers are imortal
        const mainChar = this.s.characters[this.s.mainCharacterId];
        mainChar.stamina = Math.max(0, mainChar.stamina - val);
        mainChar.hunger = Math.max(0, mainChar.hunger - val * 2.5);
    };
}
