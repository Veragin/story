import { describe, expect, it, vi } from 'vitest';
import { DUMMY_PASSAGE } from '@story/core';
import { DeltaTime, Time } from '@story/shared';
import { register } from '@story/data';
import { newSession, waitForPassage } from './support/engine';

/** `Array.prototype.at` is ES2022; `tsconfig.base.json` targets ES2020 libs. */
const last = <T>(items: T[]): T => items[items.length - 1];

/**
 * The turn loop: `History` decides *whose* turn is next, `Processor` resolves the passage and
 * applies its triggers, `Story` books the cost and the clock. Phases 7 and 8 verified
 * `village-thomas-intro → village-thomas-forest` by hand, in a browser, against the real
 * story. This is that walkthrough, automated.
 */
describe('Engine turn loop', () => {
    it('starts every registered character on their startPassageId at their chapter start', () => {
        const { e } = newSession();

        expect(Object.keys(e.history.data).sort()).toEqual(Object.keys(register.characters).sort());

        const thomas = e.history.data.thomas!;
        expect(thomas).toHaveLength(1);
        expect(thomas[0]).toMatchObject({ passageId: register.characters.thomas.startPassageId });
        expect(thomas[0].time.isEqual(register.chapters.village.timeRange.start)).toBe(true);

        const annie = e.history.data.annie!;
        expect(annie[0]).toMatchObject({ passageId: register.characters.annie.startPassageId });
        expect(annie[0].time.isEqual(register.chapters.kingdom.timeRange.start)).toBe(true);
    });

    it('starts the session on DUMMY_PASSAGE until the first turn is processed', () => {
        const { e } = newSession();

        expect(e.activePassage).toBe(DUMMY_PASSAGE);
        expect(e.store.passage).toBeNull();
    });

    it('resolves the main character"s first turn into the store', async () => {
        const { e } = newSession();

        await e.processor.continue();

        expect(e.activePassage.id).toBe('intro');
        expect(e.activePassage.chapterId).toBe('village');
        expect(e.store.passage?.id).toBe('intro');
        expect(e.store.passage?.title).toBe('Intro');
    });

    it('walks village-thomas-intro → village-thomas-forest and charges the link"s time', async () => {
        const { s, e } = newSession();
        const start = s.time.s;

        await e.processor.continue();
        const intro = e.store.passage!;

        const actions = e.processor.getPossibleActions(intro);
        expect(actions).toHaveLength(1);
        expect(actions[0].passageId).toBe('village-thomas-forest');

        e.story.goToPassage(actions[0].passageId, actions[0].cost);
        const forest = await waitForPassage(e, 'village-thomas-forest');

        expect(forest.title).toBe('Forest');
        // The link costs 10 minutes, and the clock is only allowed to move by that much.
        expect(s.time.s).toBe(start + DeltaTime.fromMin(10).s);
        expect(s.time).toBeInstanceOf(Time);
    });

    it('records every turn in history, in order, with the time it was booked for', async () => {
        const { s, e } = newSession();

        await e.processor.continue();
        e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10));
        await waitForPassage(e, 'village-thomas-forest');

        const thomas = e.history.data.thomas!;
        expect(thomas.map((h) => ('passageId' in h ? h.passageId : h.reason))).toEqual([
            'village-thomas-intro',
            'village-thomas-forest',
        ]);
        expect(last(thomas).time.s).toBe(s.time.s);
        expect(e.history.getPreviousPassageId('thomas', 'village')).toBe('village-thomas-intro');
    });

    it('mirrors the latest turn into currentHistory — the slice that gets saved', async () => {
        const { s, e } = newSession();

        await e.processor.continue();
        e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10));
        await waitForPassage(e, 'village-thomas-forest');

        expect(s.currentHistory.thomas).toMatchObject({ passageId: 'village-thomas-forest' });
        expect(s.currentHistory.thomas?.time.s).toBe(s.time.s);
    });

    it('auto-plays the non-main characters while the main character waits', async () => {
        const { e } = newSession();

        await e.processor.continue();
        e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10));
        await waitForPassage(e, 'village-thomas-forest');

        // Annie is not the main character: `Processor.autoProcess` picks a link for her and
        // the loop only hands control back once she has caught up with Thomas's clock. Her
        // passages never reach the store — only the main character's do.
        const annie = e.history.data.annie!;
        expect(annie.length).toBeGreaterThan(1);
        expect(annie.map((h) => ('passageId' in h ? h.passageId : h.reason))).toContain('kingdom-annie-palace');
        expect(e.store.passage?.characterId).toBe('thomas');
    });

    it('calls the callback a link was booked with when its turn is processed', async () => {
        const { e } = newSession();
        const onFinish = vi.fn();

        await e.processor.continue();
        e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10), onFinish);
        await waitForPassage(e, 'village-thomas-forest');

        expect(onFinish).toHaveBeenCalled();
    });

    it('fires a chapter trigger whose time falls inside the turn being played', async () => {
        const { s, e } = newSession();
        // Not `register.chapters.village.triggers[0]`: `Engine`'s constructor runs
        // `makeAutoObservable(s)`, and mobx's deep conversion *copies* every nested plain
        // object — so `s.chapters.village.ref` is an observable clone of the authored chapter,
        // and `Processor` snapshots its triggers from that clone, not from the register.
        const trigger = s.chapters.village.ref.triggers[0];

        // Plain assignment rather than `vi.spyOn`: redefining a property on a mobx proxy
        // tears its administration object off. Assigning through the proxy is a normal
        // observable write and leaves the register untouched, since this is already a clone.
        const action = vi.fn();
        const condition = vi.fn(() => true);
        trigger.action = action;
        trigger.condition = condition;
        // The authored trigger is dated `1.12 0:0` — eleven months after the chapter closes,
        // so it can never fire as written. Aim it inside the turn that is about to be played.
        trigger.time = Time.fromS(s.time.s + DeltaTime.fromMin(5).s);

        await e.processor.continue();
        e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10));
        await waitForPassage(e, 'village-thomas-forest');

        expect(condition).toHaveBeenCalled();
        expect(action).toHaveBeenCalled();
    });

    it('leaves a trigger outside the turn alone', async () => {
        const { s, e } = newSession();
        const trigger = s.chapters.village.ref.triggers[0];

        const action = vi.fn();
        trigger.action = action;
        trigger.time = Time.fromS(s.time.s + DeltaTime.fromHour(50).s);

        await e.processor.continue();
        e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10));
        await waitForPassage(e, 'village-thomas-forest');

        expect(action).not.toHaveBeenCalled();
    });

    it('skips a trigger whose condition says no', async () => {
        const { s, e } = newSession();
        const trigger = s.chapters.village.ref.triggers[0];

        const action = vi.fn();
        trigger.action = action;
        trigger.condition = vi.fn(() => false);
        trigger.time = Time.fromS(s.time.s + DeltaTime.fromMin(5).s);

        await e.processor.continue();
        e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10));
        await waitForPassage(e, 'village-thomas-forest');

        expect(action).not.toHaveBeenCalled();
    });

    describe('known defect: an auto-played turn starts the loop twice', () => {
        it('runs a booked callback once per duplicated loop', async () => {
            // `Processor.continue` ends the non-main-character branch with
            //
            //     this.autoProcess(activeScreenPassage);
            //     void this.continue();
            //
            // but `autoProcess` → `Story.goToPassage` already ends with `void continue()` of
            // its own. Every NPC's turn therefore spawns a second, parallel turn
            // loop: the next passage is resolved twice and any `onStart`/`onFinish` callback
            // the author attached to it runs twice. It fans out with the number of
            // auto-played characters, which is why it is worth catching now, while the story
            // has exactly one.
            //
            // The trailing `void this.continue()` is only needed for `autoProcess`'s
            // `addEnd` early return; moving it there is the fix, and it is a `core` source
            // change outside this phase. If this goes red, the defect is fixed — assert 1.
            const { e } = newSession();
            const onFinish = vi.fn();

            await e.processor.continue();
            e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10), onFinish);
            await waitForPassage(e, 'village-thomas-forest');

            expect(onFinish).toHaveBeenCalledTimes(2);
        });
    });
});

describe('Story.spendTime', () => {
    it('advances the clock and drains the main character once the story has started', async () => {
        const { s, e } = newSession();
        await e.processor.continue();
        e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10));
        await waitForPassage(e, 'village-thomas-forest');

        const before = { time: s.time.s, stamina: s.characters.thomas.stamina, hunger: s.characters.thomas.hunger };
        e.story.spendTime(DeltaTime.fromHour(1));

        expect(s.time.s).toBe(before.time + DeltaTime.fromHour(1).s);
        // 50 stamina per 16 hours, hunger at 2.5× that.
        expect(s.characters.thomas.stamina).toBeCloseTo(before.stamina - 50 / 16, 6);
        expect(s.characters.thomas.hunger).toBeCloseTo(before.hunger - (50 / 16) * 2.5, 6);
    });

    it('never drops stamina or hunger below zero', async () => {
        const { s, e } = newSession();
        await e.processor.continue();
        e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10));
        await waitForPassage(e, 'village-thomas-forest');

        e.story.spendTime(DeltaTime.fromHour(1000));

        expect(s.characters.thomas.stamina).toBe(0);
        expect(s.characters.thomas.hunger).toBe(0);
    });

    it('moves the clock but spares the character before their first turn is booked', () => {
        const { s, e } = newSession();

        // History holds exactly the seeded start entry: the character "hasn't started yet".
        e.story.spendTime(DeltaTime.fromHour(1));

        expect(s.time.s).toBe(register.chapters.village.timeRange.start.s + DeltaTime.fromHour(1).s);
        expect(s.characters.thomas.stamina).toBe(100);
        expect(s.characters.thomas.hunger).toBe(100);
    });
});

describe('History bookkeeping', () => {
    it('hands the turn to whichever character is furthest behind', () => {
        const { s, e } = newSession();

        // Both characters start at the same second; the main character breaks the tie.
        expect(e.history.getTurn().passageId).toBe('village-thomas-intro');

        // Book Thomas an hour into the future and Annie is now the one lagging.
        e.history.addTurn({ passageId: 'village-thomas-forest', time: Time.fromS(s.time.s + 3600) });
        expect(e.history.getTurn().passageId).toBe('kingdom-annie-intro');
    });

    it('marks a dead end with addEnd and refuses to produce another turn', () => {
        const { e } = newSession();

        for (const characterId of ['thomas', 'annie'] as const) {
            e.history.addEnd(characterId, 'NO_ACTIONS');
        }

        const ended = last(e.history.data.thomas!);
        expect('reason' in ended && ended.reason).toBe('NO_ACTIONS');
        expect(Number.isFinite(ended.time.s)).toBe(false);
        expect(() => e.history.getTurn()).toThrow('No moves left');
    });

    it('returns null from getPreviousPassageId when there is no matching earlier turn', async () => {
        const { e } = newSession();
        await e.processor.continue();

        // Only one entry so far, and it is not in the kingdom.
        expect(e.history.getPreviousPassageId('thomas', 'kingdom')).toBeNull();
        expect(e.history.getPreviousPassageId('annie', 'kingdom')).toBeNull();
    });
});

describe('Processor cost handling', () => {
    it('normalises the three shapes of TLinkCost', () => {
        const { e } = newSession();

        expect(e.processor.parseCost(undefined)).toEqual({ time: DeltaTime.fromS(0), items: [], tools: [] });
        expect(e.processor.parseCost(DeltaTime.fromMin(4))).toEqual({
            time: DeltaTime.fromMin(4),
            items: [],
            tools: [],
        });
        expect(e.processor.parseCost({ items: [{ id: 'berries', amount: 2 }] })).toEqual({
            time: DeltaTime.fromS(0),
            items: [{ id: 'berries', amount: 2 }],
        });
    });

    it('blocks an action the character cannot pay for and allows one they can', () => {
        const { e } = newSession();

        expect(e.processor.isActionPossible(undefined)).toBe(true);
        expect(e.processor.isActionPossible(DeltaTime.fromMin(1))).toBe(true);

        // Thomas starts with one bow and nothing else.
        expect(e.processor.isActionPossible({ tools: ['bow'] })).toBe(true);
        expect(e.processor.isActionPossible({ tools: ['axe'] })).toBe(false);
        expect(e.processor.isActionPossible({ items: [{ id: 'bow', amount: 1 }] })).toBe(true);
        expect(e.processor.isActionPossible({ items: [{ id: 'bow', amount: 2 }] })).toBe(false);
        expect(e.processor.isActionPossible({ items: [{ id: 'berries', amount: 1 }] })).toBe(false);
    });

    it('filters unaffordable links out of getPossibleActions', async () => {
        const { e } = newSession();
        await e.processor.continue();

        const passage = e.store.passage!;
        expect(e.processor.getPossibleActions(passage)).toHaveLength(1);

        const unaffordable = {
            ...passage,
            body: [{ links: [{ text: 'nope', passageId: 'village-thomas-forest', cost: { tools: ['axe'] } }] }],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        expect(e.processor.getPossibleActions(unaffordable)).toHaveLength(0);
    });

    it('skips body blocks whose condition is false', async () => {
        const { e } = newSession();
        await e.processor.continue();

        const passage = e.store.passage!;
        const hidden = {
            ...passage,
            body: [{ condition: false, links: passage.body[0].links }],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        expect(e.processor.getPossibleActions(hidden)).toHaveLength(0);
    });
});
