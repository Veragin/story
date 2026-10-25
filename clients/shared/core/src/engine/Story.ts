import { DeltaTime, showToast, TPassageId } from '@story/shared';
import { TLink, TLinkClick } from '@story/types';
import type { TWorldState } from '@story/data';
import { Engine } from './Engine';
import { parsePassageId } from '../parsePassageId';
import { action, makeObservable, runInAction } from 'mobx';

export class Story {
    constructor(
        private s: TWorldState,
        private e: Engine
    ) {
        makeObservable(this, {
            spendTime: action,
        });
    }

    goToPassage = (link: TLink<TPassageId>) => {
        const { characterId } = parsePassageId(link.passageId);
        const cost = this.e.processor.parseCost(link.cost);
        this.runOnLinkClick({ link, characterId, ...cost });

        this.e.history.addTurn({
            passageId: link.passageId,
            time: this.s.time.moveToFutureBy(cost.time),
            onStart: link.onFinish,
        });

        if (cost.items.length > 0 && characterId === this.s.mainCharacterId) {
            const { itemInfo } = this.e.storyModule;
            showToast(
                _(
                    'You have spent: %s',
                    cost.items.map((item) => `${item.amount} ${itemInfo[item.id].name}`).join(', ')
                ),
                {
                    variant: 'info',
                }
            );
        }
        cost.items.forEach((item) => this.e.inventory.removeItem(item, characterId));

        void this.e.processor.continue();
    };

    spendTime = (time: DeltaTime) => {
        this.s.time = this.s.time.moveToFutureBy(time);
    };

    // a broken story hook must not block the player
    private runOnLinkClick = (click: TLinkClick) => {
        const onLinkClick = this.e.storyModule.engine?.onLinkClick;
        if (onLinkClick === undefined) return;
        try {
            runInAction(() => onLinkClick(click, this.s, this.e));
        } catch (error) {
            console.error('onLinkClick failed', error);
            showToast(_("The story's onLinkClick failed: %s", error instanceof Error ? error.message : String(error)), {
                variant: 'error',
            });
        }
    };
}
