import type { TWorldState } from '@story/data';
import { Engine } from './Engine';
import { DeltaTime, Time, TPassageId } from '@story/shared';
import { TChapter, TChapterId, TLinkClick, TLinkCost } from '@story/types';
import { TUnkownPassageScreen } from './const';
import { parsePassageId } from '../parsePassageId';

export class Processor {
    private chapterList: TChapter<TChapterId>[];

    constructor(
        private s: TWorldState,
        private e: Engine
    ) {
        this.chapterList = Object.values(this.s.chapters).map((chapter) => chapter.ref);
    }

    continue = async () => {
        const turn = this.e.history.getTurn();

        const shouldTrigger = isInRange(this.s.time, turn.time);
        for (const chapter of this.activeChapters) {
            chapter.triggers.forEach((trigger) => {
                if (shouldTrigger(trigger.time) && trigger.condition()) {
                    trigger.action();
                }
            });
        }

        const distance = this.s.time.distance(turn.time);
        this.e.story.spendTime(distance);
        turn.onStart?.();

        const { chapterId } = parsePassageId(turn.passageId);
        const passages = await this.e.storyModule.register.passages[chapterId]();
        this.e.activePassage = passages.default[turn.passageId](this.s, this.e);
        this.e.activePassage.execute?.();

        if (this.e.activePassage.type === 'finish') {
            this.redirectTo(this.e.activePassage.nextPassageId);
            return;
        }

        if (this.e.activePassage.type === 'redirect') {
            const redirect = this.e.activePassage.body.find((b) => b.condition !== false)?.redirect;
            if (redirect === undefined) {
                this.e.history.addEnd(this.e.activePassage.characterId, 'NO_ACTIONS');
                void this.continue();
                return;
            }
            this.redirectTo(redirect);
            return;
        }

        const activeScreenPassage = this.e.activePassage as TUnkownPassageScreen;
        if (this.e.activePassage.characterId !== this.s.mainCharacterId) {
            this.autoProcess(activeScreenPassage);
            return;
        }

        this.e.store.setPassage(activeScreenPassage);
    };

    private redirectTo = (passageId: TPassageId) => {
        this.e.history.addTurn({ passageId, time: this.s.time });
        void this.continue();
    };

    private autoProcess = (p: TUnkownPassageScreen) => {
        const actions = this.getPossibleActions(p);
        if (actions.length === 0) {
            this.e.history.addEnd(p.characterId, 'NO_ACTIONS');
            void this.continue();
            return;
        }

        const priority = (link: (typeof actions)[number]) => link.autoPriortiy ?? 1;
        const action = actions.reduce((best, a) => (priority(a) > priority(best) ? a : best));

        this.e.story.goToPassage(action);
    };

    getPossibleActions = (p: TUnkownPassageScreen) => {
        const links = p.body.filter((b) => b.condition !== false).flatMap((b) => b.links ?? []);
        return links.filter((l) => this.isActionPossible(l.cost));
    };

    isActionPossible = (cost?: TLinkCost) => {
        if (cost === undefined) return true;
        const { items, tools } = this.parseCost(cost);

        return (
            items.every((item) => this.e.inventory.getItemAmount(item.id) >= item.amount) &&
            tools.every((toolId) => this.e.inventory.getItemAmount(toolId) >= 1)
        );
    };

    parseCost = (cost?: TLinkCost): TParsedCost => {
        if (cost === undefined) {
            return { time: DeltaTime.fromS(0), items: [], tools: [] };
        }
        if (cost instanceof DeltaTime) {
            return { time: cost, items: [], tools: [] };
        }

        return { time: cost.time ?? DeltaTime.fromS(0), items: cost.items ?? [], tools: cost.tools ?? [] };
    };

    private get activeChapters() {
        return this.chapterList.filter((chapter) =>
            isInRange(chapter.timeRange.start, chapter.timeRange.end)(this.s.time)
        );
    }
}

type TParsedCost = Pick<TLinkClick, 'time' | 'items' | 'tools'>;

const isInRange = (start: Time, end: Time) => (time: Time) => !start.isAfter(time) && end.isAfter(time);
