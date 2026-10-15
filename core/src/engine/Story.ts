import { DeltaTime, showToast, TPassageId } from '@story/shared';
import { TLinkCost } from '@story/types';
import type { TWorldState } from '@story/data';
import { Engine } from './Engine';
import { parsePassageId } from '../parsePassageId';
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
            const { itemInfo } = this.e.storyModule;
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
    };
}
