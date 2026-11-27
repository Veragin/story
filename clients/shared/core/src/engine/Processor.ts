import type { TWorldState } from '@story/data';
import { Engine } from './Engine';
import { DeltaTime, Time, TPassageId } from '@story/shared';
import { TChapter, TChapterId, TCharacterId, TLink, TLinkClick, TLinkCost } from '@story/types';
import { TPlayablePassage } from './const';
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
        const passage = passages.default[turn.passageId](this.s, this.e);
        this.e.activePassage = passage;
        passage.execute?.();

        switch (passage.type) {
            case 'finish':
                this.redirectTo(passage.nextPassageId);
                return;
            case 'start':
                this.redirectOrEnd(passage.characterId, passage.nextPassageId);
                return;
            case 'redirect':
                this.redirectOrEnd(passage.characterId, passage.body.find((b) => b.condition !== false)?.redirect);
                return;
            case 'screen':
            case 'linear':
                this.play(passage);
                return;
        }
    };

    private play = (passage: TPlayablePassage) => {
        if (passage.characterId !== this.s.mainCharacterId) {
            this.autoProcess(passage);
            return;
        }

        this.e.store.setPassage(passage);
    };

    private redirectTo = (passageId: TPassageId) => {
        this.e.history.addTurn({ passageId, time: this.s.time });
        void this.continue();
    };

    private redirectOrEnd = (characterId: TCharacterId, passageId: TPassageId | undefined) => {
        if (passageId === undefined) {
            this.endWithNoActions(characterId);
            return;
        }
        this.redirectTo(passageId);
    };

    private endWithNoActions = (characterId: TCharacterId) => {
        this.e.history.addEnd(characterId, 'NO_ACTIONS');
        void this.continue();
    };

    private autoProcess = (p: TPlayablePassage) => {
        const actions = this.getPossibleActions(p);
        if (actions.length === 0) {
            this.endWithNoActions(p.characterId);
            return;
        }

        const priority = (link: (typeof actions)[number]) => link.autoPriortiy ?? 1;
        const action = actions.reduce((best, a) => (priority(a) > priority(best) ? a : best));

        this.e.story.goToPassage(action);
    };

    getLinks = (p: TPlayablePassage): TLink<TPassageId>[] => {
        if (p.type === 'linear') {
            return p.nextPassageId === undefined ? [] : [{ text: _('Continue'), passageId: p.nextPassageId }];
        }
        return p.body.filter((b) => b.condition !== false).flatMap((b) => b.links ?? []);
    };

    getPossibleActions = (p: TPlayablePassage) => this.getLinks(p).filter((l) => this.isActionPossible(l.cost));

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
