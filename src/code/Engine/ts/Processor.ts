import { TWorldState } from 'data/TWorldState';
import { Engine } from './Engine';
import { DeltaTime, Time } from 'time/Time';
import { register } from 'data/register';
import { TLinkCost } from 'types/TPassage';
import { TUnkownPassageScreen } from './const';
import { parsePassageId } from 'code/utils/parsePassageId';

export class Processor {
    private eventList = Object.values(this.s.events).map((event) => event.ref);

    constructor(
        private s: TWorldState,
        private e: Engine
    ) {}

    continue = async () => {
        const turn = this.e.history.getTurn();

        const shouldTrigger = isInRange(this.s.time, turn.time);
        for (const event of this.activeEvents) {
            event.triggers.forEach((trigger) => {
                if (shouldTrigger(trigger.time) && trigger.condition()) {
                    trigger.action();
                }
            });
        }

        const distance = this.s.time.distance(turn.time);
        this.e.story.spendTime(distance);
        turn.onStart?.();

        const { eventId } = parsePassageId(turn.passageId);
        const passageFun = await register.passages[eventId]();
        this.e.activePassage = (passageFun.default as any)[turn.passageId](this.s, this.e);

        if (this.e.activePassage.type === 'transition') {
            this.e.history.addTurn({
                passageId: this.e.activePassage.nextPassageId,
                time: this.s.time,
            });
            void this.continue();
            return;
        }

        const redirect = this.e.activePassage.body.find(
            (b) => b.condition !== false && b.redirect !== undefined
        )?.redirect;
        if (redirect !== undefined) {
            this.e.history.addTurn({
                passageId: redirect,
                time: this.s.time,
            });
            void this.continue();
            return;
        }

        if (this.e.activePassage.characterId !== this.s.mainCharacterId) {
            this.autoProcess(this.e.activePassage);
            void this.continue();
            return;
        }

        this.e.store.setPassage(this.e.activePassage);
    };

    private autoProcess = (p: TUnkownPassageScreen) => {
        const actions = this.getPossibleActions(p);
        if (actions.length === 0) {
            this.e.history.addEnd(p.characterId, 'NO_ACTIONS');
            return;
        }

        let action = actions[0];
        for (const a of actions) {
            if (a.autoPriortiy ?? 1 > (action.autoPriortiy ?? 1)) {
                action = a;
            }
        }

        this.e.story.goToPassage(action.passageId, action.cost, action.onFinish);
    };

    getPossibleActions = (p: TUnkownPassageScreen) => {
        const links = p.body.filter((b) => b.condition !== false).flatMap((b) => b.links ?? []);
        return links.filter((l) => this.isActionPossible(l.cost));
    };

    isActionPossible = (cost?: TLinkCost) => {
        if (cost === undefined) return true;
        const { items, tools } = this.parseCost(cost);

        if (items !== undefined && items.some((item) => this.e.inventory.getItemAmount(item.id) < item.amount)) {
            return false;
        }
        if (tools !== undefined && tools.some((toolId) => this.e.inventory.getItemAmount(toolId) < 1)) {
            return false;
        }
        return true;
    };

    parseCost = (cost?: TLinkCost) => {
        if (cost === undefined) {
            return { time: DeltaTime.fromS(0), items: [], tools: [] };
        }
        if (cost instanceof DeltaTime) {
            return { time: cost, items: [], tools: [] };
        }

        return { time: DeltaTime.fromS(0), ...cost };
    };

    private get activeEvents() {
        return this.eventList.filter((event) => isInRange(event.timeRange.start, event.timeRange.end)(this.s.time));
    }
}

const isInRange = (start: Time, end: Time) => (time: Time) => start.isAfter(time) && end.isBefore(time);
