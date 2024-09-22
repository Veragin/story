import { TWorldState } from 'data/TWorldState';
import { Engine } from './Engine';
import { DeltaTime, Time } from 'time/Time';
import { register } from 'data/register';
import { TLinkCost, TPassageScreen } from 'types/TPassage';

export class Processor {
    private eventList = Object.values(this.s.events).map((event) => event.ref);

    constructor(private s: TWorldState, private e: Engine) {}

    continue = () => {
        const turn = this.e.history.getTurn();

        const shouldTrigger = isInRange(this.s.time, turn.time);
        for (const event of this.activeEvents) {
            event.triggers.forEach((trigger) => {
                if (shouldTrigger(trigger.time) && trigger.condition()) {
                    trigger.action();
                }
            });
        }

        this.e.story.spendTime(this.s.time.distance(turn.time));
        turn.onStart?.();

        this.e.activePassage =
            register.events[turn.passagePt.eventId].passages[turn.passagePt.characterId][
                turn.passagePt.passageId
            ]();
    };

    private autoProcess = () => {
        const actions = this.getPossibleActions();

        if (actions.length === 1) {
            this.processAction(actions[0]);
        }
    };

    getPossibleActions = () => {
        const p = this.e.activePassage;
        if (p.type === 'screen') {
            const links = p.body.filter((b) => b.condition).flatMap((b) => b.links);
            return links.filter((l) => this.isActionPossible(l.cost));
        }
        return [];
    };

    isActionPossible = (cost: TLinkCost) => {
        const { items, tools } = this.parseCost(cost);
        if (
            items !== undefined &&
            items.some((item) => this.e.inventory.getItemCount(item.id) < item.count)
        ) {
            return false;
        }
        if (
            tools !== undefined &&
            tools.some((toolId) => this.e.inventory.getItemCount(toolId) < 0)
        ) {
            return false;
        }
        return true;
    };

    parseCost = (cost: TLinkCost) => {
        if (cost instanceof DeltaTime) {
            return { time: cost, items: [], tools: [] };
        }

        return { time: DeltaTime.fromS(0), ...cost };
    };

    private get activeEvents() {
        return this.eventList.filter((event) =>
            isInRange(event.timeRange.start, event.timeRange.end)(this.s.time)
        );
    }
}

const isInRange = (start: Time, end: Time) => (time: Time) =>
    start.isAfter(time) && end.isBefore(time);
