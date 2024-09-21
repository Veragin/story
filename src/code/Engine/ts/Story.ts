import { DeltaTime } from 'code/time/Time';
import { TWorldState } from 'data/TWorldState';
import { TCharacterIdInEvent, TEventId, TPassageId } from 'types/TIds';
import { TLinkCost } from 'types/TPassage';

export class Story {
    constructor(private s: TWorldState) {}

    goToPassage = (id: TPassageId<TEventId, TCharacterIdInEvent<TEventId>>, cost: TLinkCost) => {};

    spendTime = (time: DeltaTime) => {
        this.s.time = this.s.time.moveToFutureBy(time);
        const val = (time.hour * 50) / 16;
        s().energy = Math.max(0, s().energy - val);
        s().hunger = Math.max(0, s().hunger - val * 2.5);
    };
}
