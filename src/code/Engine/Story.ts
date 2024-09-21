import { DeltaTime } from 'code/time/Time';
import { TWorldState } from 'data/TWorldState';
import { TCharacterId, TEventId, TPassageId } from 'types/TCharacter';
import { TPassageCost } from 'types/TPassage';

export class Story {
    constructor(private s: TWorldState) {}

    goToPassage = (id: TPassageId<TCharacterId, TEventId>, cost: TPassageCost) => {};

    spendTime = (time: DeltaTime) => {
        this.s.time = this.s.time.moveToFutureBy(time);
        const val = (time.hour * 50) / 16;
        s().energy = Math.max(0, s().energy - val);
        s().hunger = Math.max(0, s().hunger - val * 2.5);
    };
}
