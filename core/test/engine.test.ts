import { describe, expect, it, vi } from 'vitest';
import { DeltaTime, Time } from '@story/shared';
import { createWorldState, type Engine, type TPassagesModule } from '@story/core';
import { itemInfo, register } from '@story/data';
import type { TWorldState } from '@story/data';
import type { TChapterId, TChapterPassage } from '@story/types';
import { newSession, TEST_STORY_ID, waitForPassage } from './support/engine';

// `Array.prototype.at` is ES2022; the libs target ES2020
const last = <T>(items: T[]): T => items[items.length - 1];

type TPassageFn = (s: TWorldState, e: Engine) => TChapterPassage<TChapterId>;

const sessionWith = (extra: Record<string, TPassageFn>) => {
    const passages = {
        ...register.passages,
        village: async (): Promise<TPassagesModule> => {
            const module = (await register.passages.village()) as unknown as TPassagesModule;
            return { default: { ...module.default, ...extra } };
        },
    };
    return createWorldState({ ...register, passages } as typeof register, itemInfo, TEST_STORY_ID);
};

const screen = (
    id: string,
    fields: Partial<Extract<TChapterPassage<'village'>, { type: 'screen' }>>
): TChapterPassage<'village'> => ({
    chapterId: 'village',
    characterId: 'thomas',
    id,
    type: 'screen',
    title: id,
    image: '',
    body: [],
    ...fields,
});

// keeps tests independent of how the chapters' time ranges interleave
const soloThomas = async (e: Engine) => {
    e.history.addEnd('annie', 'NO_ACTIONS');
    await e.processor.continue();
};

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

    it('starts the session on a dummy passage of the main character until the first turn is processed', () => {
        const { s, e } = newSession();

        expect(e.activePassage).toMatchObject({ type: 'screen', body: [], characterId: s.mainCharacterId });
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

        // Annie is auto-played; only the main character's passages reach the store
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
        // `makeAutoObservable` deep-copies `s`, so `Processor` reads triggers from the clone
        const trigger = s.chapters.village.ref.triggers[0];

        // `vi.spyOn` would tear the mobx proxy's administration off
        const action = vi.fn();
        const condition = vi.fn(() => true);
        trigger.action = action;
        trigger.condition = condition;
        // the authored trigger can never fire; aim it inside the coming turn
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

    describe('passage execute', () => {
        it('runs execute once per entry', async () => {
            const execute = vi.fn();
            const { e } = sessionWith({
                'village-thomas-probe': () =>
                    screen('probe', {
                        execute,
                        body: [{ links: [{ text: 'again', passageId: 'village-thomas-probe' }] }],
                    }),
            });
            await soloThomas(e);
            expect(execute).not.toHaveBeenCalled();

            e.story.goToPassage('village-thomas-probe', DeltaTime.fromMin(1));
            await waitForPassage(e, 'village-thomas-probe');
            expect(execute).toHaveBeenCalledTimes(1);

            // Re-entering the same passage is a new entry.
            const turns = e.history.data.thomas!.length;
            e.story.goToPassage('village-thomas-probe', DeltaTime.fromMin(1));
            await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
            expect(e.history.data.thomas).toHaveLength(turns + 1);
        });

        it('evaluates a body condition on the entry state, not the state after execute', async () => {
            const { s, e } = sessionWith({
                'village-thomas-probe': (s) =>
                    screen('probe', {
                        execute: () => {
                            s.characters.thomas.health = 1;
                        },
                        body: [{ condition: s.characters.thomas.health > 1, text: 'healthy on entry' }],
                    }),
            });
            await soloThomas(e);
            expect(s.characters.thomas.health).toBeGreaterThan(1);

            e.story.goToPassage('village-thomas-probe', DeltaTime.fromMin(1));
            const probe = await waitForPassage(e, 'village-thomas-probe');

            expect(s.characters.thomas.health).toBe(1);
            expect(probe.body[0].condition).toBe(true);
        });

        it('lets the following link"s onFinish and the next passage see what execute did', async () => {
            const seenByOnFinish = vi.fn();
            const { s, e } = sessionWith({
                'village-thomas-probe': (s) =>
                    screen('probe', {
                        execute: () => {
                            s.characters.thomas.health = 42;
                        },
                        body: [
                            {
                                links: [
                                    {
                                        text: 'on',
                                        passageId: 'village-thomas-next',
                                        onFinish: () => seenByOnFinish(s.characters.thomas.health),
                                    },
                                ],
                            },
                        ],
                    }),
                'village-thomas-next': (s) =>
                    screen('next', { body: [{ condition: s.characters.thomas.health === 42, text: 'saw it' }] }),
            });
            await soloThomas(e);

            e.story.goToPassage('village-thomas-probe', DeltaTime.fromMin(1));
            const probe = await waitForPassage(e, 'village-thomas-probe');
            const [link] = e.processor.getPossibleActions(probe);
            e.story.goToPassage(link.passageId, link.cost, link.onFinish);
            const next = await waitForPassage(e, 'village-thomas-next');

            expect(seenByOnFinish).toHaveBeenCalledWith(42);
            expect(next.body[0].condition).toBe(true);
            expect(s.characters.thomas.health).toBe(42);
        });

        it('runs execute on a transition passage too, before moving on', async () => {
            const execute = vi.fn();
            const { e } = sessionWith({
                'village-thomas-hop': () => ({
                    chapterId: 'village',
                    characterId: 'thomas',
                    id: 'hop',
                    type: 'transition',
                    execute,
                    nextPassageId: 'village-thomas-next',
                }),
                'village-thomas-next': () => screen('next', {}),
            });
            await soloThomas(e);

            e.story.goToPassage('village-thomas-hop', DeltaTime.fromMin(1));
            await waitForPassage(e, 'village-thomas-next');

            expect(execute).toHaveBeenCalledTimes(1);
        });
    });

    describe('an auto-played turn', () => {
        it('starts the loop once, so the next passage and its callbacks run once per entry', async () => {
            // Regression: every NPC turn used to start a second, parallel loop.
            const probeExecute = vi.fn();
            const restExecute = vi.fn();
            const onFinish = vi.fn();
            const { s, e } = sessionWith({
                'village-annie-probe': () => ({
                    ...screen('probe', {
                        execute: probeExecute,
                        body: [{ links: [{ text: 'rest', passageId: 'village-annie-rest', onFinish }] }],
                    }),
                    characterId: 'annie',
                }),
                // No links: Annie's story ends here and the loop hands over to Thomas.
                'village-annie-rest': () => ({
                    ...screen('rest', { execute: restExecute }),
                    characterId: 'annie',
                }),
                'village-thomas-probe': () => screen('probe', {}),
            });
            // Set the turns by hand so the test does not depend on the chapters' time ranges.
            e.history.data.annie = [{ passageId: 'village-annie-probe', time: s.time }];
            e.history.data.thomas = [
                { passageId: 'village-thomas-probe', time: s.time.moveToFutureBy(DeltaTime.fromMin(60)) },
            ];

            await e.processor.continue();
            await waitForPassage(e, 'village-thomas-probe');

            expect(probeExecute).toHaveBeenCalledTimes(1);
            expect(onFinish).toHaveBeenCalledTimes(1);
            expect(restExecute).toHaveBeenCalledTimes(1);
            expect(last(e.history.data.annie!)).toMatchObject({ reason: 'NO_ACTIONS' });
        });
    });
});

describe('Story.spendTime', () => {
    it('advances the clock', () => {
        const { s, e } = newSession();

        e.story.spendTime(DeltaTime.fromHour(1));

        expect(s.time.s).toBe(register.chapters.village.timeRange.start.s + DeltaTime.fromHour(1).s);
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
