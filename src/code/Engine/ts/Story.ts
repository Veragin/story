import { DeltaTime } from 'time/Time';
import { TWorldState } from 'data/TWorldState';
import { TPassageId } from 'types/TIds';
import { TLinkCost } from 'types/TPassage';
import { Engine } from './Engine';
import { parsePassageId } from 'code/utils/parsePassageId';
import { showToast } from 'code/GlobalWrapper';
import { itemInfo } from 'data/items/itemInfo';
import { action, makeObservable } from 'mobx';

export class Story {
    constructor(
        private s: TWorldState,
        private e: Engine
    ) {
        makeObservable(this, {
            spendTime: action,
        });
    }

    goToPassage = (passageId: TPassageId, cost?: TLinkCost, cb?: () => void) => {
        const { characterId } = parsePassageId(passageId);
        const { time, items } = this.e.processor.parseCost(cost);

        this.e.history.addTurn({
            passageId,
            time: this.s.time.moveToFutureBy(time),
            onStart: cb,
        });

        if (items && items.length > 0 && characterId === this.s.mainCharacterId) {
            showToast(
                _('You have spent: %s', items.map((item) => `${item.amount} ${itemInfo[item.id].name}`).join(', ')),
                {
                    variant: 'info',
                }
            );
        }
        items?.forEach((item) => this.e.inventory.removeItem(item), characterId);

        void this.e.processor.continue();
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
