import { DeltaTime } from 'time/Time';
import { TWorldState } from 'data/TWorldState';
import { TCharacterIdInEvent, TEventId } from 'types/TIds';
import { TLinkCost } from 'types/TPassage';
import { Engine } from './Engine';
import { TPassagePt } from 'types/TCharacter';

export class Story {
    constructor(private s: TWorldState, private e: Engine) {}

    goToPassage = <E extends TEventId>(
        pt: TPassagePt<E, TCharacterIdInEvent<E>>,
        cost: TLinkCost,
        cb?: () => void
    ) => {
        const { time, items } = this.e.processor.parseCost(cost);
        this.e.history.addTurn({
            passagePt: pt,
            time: this.s.time.moveToFutureBy(time),
            onStart: cb,
        });

        items?.forEach((item) => this.e.inventory.removeItem(item), pt.characterId);

        this.e.processor.continue();
    };

    spendTime = (time: DeltaTime) => {
        this.s.time = this.s.time.moveToFutureBy(time);
        const val = (time.hour * 50) / 16;

        // computers are imortal
        const mainChar = this.s.characters[this.s.mainCharacterId];
        mainChar.stamina = Math.max(0, mainChar.stamina - val);
        mainChar.hunger = Math.max(0, mainChar.hunger - val * 2.5);
    };
}
