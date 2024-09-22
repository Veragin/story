import { TWorldState } from 'data/TWorldState';
import { Engine } from './Engine';
import { Time } from 'code/time/Time';
import { register } from 'data/register';

export class Processor {
    private eventList = Object.values(this.s.events).map((event) => event.ref);

    constructor(private s: TWorldState, private e: Engine) {}

    continue = () => {
        const { characterId, eventId, passageId, time, onStart } = this.e.history.getTurn();

        const shouldTrigger = isInRange(this.s.time, time);
        for (const event of this.activeEvents) {
            event.triggers.forEach((trigger) => {
                if (shouldTrigger(trigger.time) && trigger.condition()) {
                    trigger.action();
                }
            });
        }

        this.e.story.spendTime(this.s.time.distance(time));
        onStart?.();

        this.e.activePassage = register.events[eventId].passages[characterId][passageId]();
    };

    private get activeEvents() {
        return this.eventList.filter((event) =>
            isInRange(event.timeRange.start, event.timeRange.end)(this.s.time)
        );
    }
}

const isInRange = (start: Time, end: Time) => (time: Time) =>
    start.isAfter(time) && end.isBefore(time);
