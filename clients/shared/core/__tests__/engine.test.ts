import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeltaTime, setToastHandler, Time } from '@story/shared';
import { createWorldState, type Engine, type TPassagesModule } from '@story/core';
import { itemInfo, register } from '@story/data';
import type { TWorldState } from '@story/data';
import type { TChapterId, TChapterPassage, TEngineSettings } from '@story/types';
import { linkTo, newSession, PAST_ANNIE_START, TEST_STORY_ID, waitForLinear, waitForPassage } from './support/engine';

// `Array.prototype.at` is ES2022; the libs target ES2020
const last = <T>(items: T[]): T => items[items.length - 1];

type TPassageFn = (s: TWorldState, e: Engine) => TChapterPassage<TChapterId>;

const sessionWith = (extra: Record<string, TPassageFn>, engine?: TEngineSettings) => {
    const passages = {
        ...register.passages,
        village: async (): Promise<TPassagesModule> => {
            const module = (await register.passages.village()) as unknown as TPassagesModule;
            return { default: { ...module.default, ...extra } };
        },
    };
    return createWorldState(
        { register: { ...register, passages } as typeof register, itemInfo, engine },
        TEST_STORY_ID
    );
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

const start = (id: string): Extract<TChapterPassage<'village'>, { type: 'start' }> => ({
    chapterId: 'village',
    characterId: 'thomas',
    id,
    type: 'start',
    description: `${id} description`,
});

const linear = (id: string): Extract<TChapterPassage<'village'>, { type: 'linear' }> => ({
    chapterId: 'village',
    characterId: 'thomas',
    id,
    type: 'linear',
    description: `${id} description`,
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
        expect(e.store.passage).toMatchObject({ id: 'intro', type: 'screen', title: 'Intro' });
    });

    it('walks village-thomas-intro → village-thomas-forest and charges the link"s time', async () => {
        const { s, e } = newSession();
        const start = s.time.s;

        await e.processor.continue();
        const intro = await waitForPassage(e, 'village-thomas-intro');

        const actions = e.processor.getPossibleActions(intro);
        expect(actions).toHaveLength(1);
        expect(actions[0].passageId).toBe('village-thomas-forest');

        e.story.goToPassage(actions[0]);
        const forest = await waitForPassage(e, 'village-thomas-forest');

        expect(forest.title).toBe('Forest');
        expect(s.time.s).toBe(start + DeltaTime.fromMin(10).s);
        expect(s.time).toBeInstanceOf(Time);
    });

    it('records every turn in history, in order, with the time it was booked for', async () => {
        const { s, e } = newSession();

        await e.processor.continue();
        e.story.goToPassage(linkTo('village-thomas-forest', DeltaTime.fromMin(10)));
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
        e.story.goToPassage(linkTo('village-thomas-forest', DeltaTime.fromMin(10)));
        await waitForPassage(e, 'village-thomas-forest');

        expect(s.currentHistory.thomas).toMatchObject({ passageId: 'village-thomas-forest' });
        expect(s.currentHistory.thomas?.time.s).toBe(s.time.s);
    });

    it('auto-plays the non-main characters while the main character waits', async () => {
        const { e } = newSession();

        await e.processor.continue();
        e.story.goToPassage(linkTo('village-thomas-forest', PAST_ANNIE_START));
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
        e.story.goToPassage(linkTo('village-thomas-forest', DeltaTime.fromMin(10), onFinish));
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
        e.story.goToPassage(linkTo('village-thomas-forest', DeltaTime.fromMin(10)));
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
        e.story.goToPassage(linkTo('village-thomas-forest', DeltaTime.fromMin(10)));
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
        e.story.goToPassage(linkTo('village-thomas-forest', DeltaTime.fromMin(10)));
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

            e.story.goToPassage(linkTo('village-thomas-probe', DeltaTime.fromMin(1)));
            await waitForPassage(e, 'village-thomas-probe');
            expect(execute).toHaveBeenCalledTimes(1);

            // Re-entering the same passage is a new entry.
            const turns = e.history.data.thomas!.length;
            e.story.goToPassage(linkTo('village-thomas-probe', DeltaTime.fromMin(1)));
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

            e.story.goToPassage(linkTo('village-thomas-probe', DeltaTime.fromMin(1)));
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

            e.story.goToPassage(linkTo('village-thomas-probe', DeltaTime.fromMin(1)));
            const probe = await waitForPassage(e, 'village-thomas-probe');
            const [link] = e.processor.getPossibleActions(probe);
            e.story.goToPassage(link);
            const next = await waitForPassage(e, 'village-thomas-next');

            expect(seenByOnFinish).toHaveBeenCalledWith(42);
            expect(next.body[0].condition).toBe(true);
            expect(s.characters.thomas.health).toBe(42);
        });

        it('runs execute on a finish passage too, before moving on', async () => {
            const execute = vi.fn();
            const { e } = sessionWith({
                'village-thomas-hop': () => ({
                    chapterId: 'village',
                    characterId: 'thomas',
                    id: 'hop',
                    type: 'finish',
                    execute,
                    nextPassageId: 'village-thomas-next',
                }),
                'village-thomas-next': () => screen('next', {}),
            });
            await soloThomas(e);

            e.story.goToPassage(linkTo('village-thomas-hop', DeltaTime.fromMin(1)));
            await waitForPassage(e, 'village-thomas-next');

            expect(execute).toHaveBeenCalledTimes(1);
        });
    });

    describe('a redirect passage', () => {
        const redirectSession = (conditions: [boolean | undefined, boolean | undefined]) =>
            sessionWith({
                'village-thomas-fork': () => ({
                    chapterId: 'village',
                    characterId: 'thomas',
                    id: 'fork',
                    type: 'redirect',
                    body: [
                        { condition: conditions[0], redirect: 'village-thomas-left' },
                        { condition: conditions[1], redirect: 'village-thomas-right' },
                    ],
                }),
                'village-thomas-left': () => screen('left', {}),
                'village-thomas-right': () => screen('right', {}),
            });

        it('follows the first redirect whose condition holds', async () => {
            const { e } = redirectSession([false, true]);
            await soloThomas(e);

            e.story.goToPassage(linkTo('village-thomas-fork', DeltaTime.fromMin(1)));
            await waitForPassage(e, 'village-thomas-right');

            expect(e.store.passage?.id).toBe('right');
        });

        it('treats a missing condition as true', async () => {
            const { e } = redirectSession([undefined, true]);
            await soloThomas(e);

            e.story.goToPassage(linkTo('village-thomas-fork', DeltaTime.fromMin(1)));
            await waitForPassage(e, 'village-thomas-left');

            expect(e.store.passage?.id).toBe('left');
        });
    });

    describe('a start passage', () => {
        it('runs execute and moves straight on to nextPassageId, free of charge', async () => {
            const execute = vi.fn();
            const { s, e } = sessionWith({
                'village-thomas-entry': () => ({
                    ...start('entry'),
                    execute,
                    nextPassageId: 'village-thomas-next',
                }),
                'village-thomas-next': () => screen('next', {}),
            });
            await soloThomas(e);

            e.story.goToPassage(linkTo('village-thomas-entry', DeltaTime.fromMin(1)));
            const booked = s.time.s;
            await waitForPassage(e, 'village-thomas-next');

            expect(execute).toHaveBeenCalledTimes(1);
            expect(s.time.s).toBe(booked);
            expect(e.history.data.thomas!.map((h) => ('passageId' in h ? h.passageId : h.reason))).toEqual(
                expect.arrayContaining(['village-thomas-entry', 'village-thomas-next'])
            );
        });

        it('ends the character with NO_ACTIONS when it has no nextPassageId', async () => {
            const { s, e } = sessionWith({
                'village-annie-entry': () => ({ ...start('entry'), characterId: 'annie' }),
                'village-thomas-probe': () => screen('probe', {}),
            });
            e.history.data.annie = [{ passageId: 'village-annie-entry', time: s.time }];
            e.history.data.thomas = [
                { passageId: 'village-thomas-probe', time: s.time.moveToFutureBy(DeltaTime.fromMin(60)) },
            ];

            await e.processor.continue();
            await waitForPassage(e, 'village-thomas-probe');

            expect(last(e.history.data.annie!)).toMatchObject({ reason: 'NO_ACTIONS' });
        });
    });

    describe('a linear passage', () => {
        it('reaches the store with a single free Continue link to nextPassageId', async () => {
            const { s, e } = sessionWith({
                'village-thomas-walk': () => ({ ...linear('walk'), nextPassageId: 'village-thomas-next' }),
                'village-thomas-next': () => screen('next', {}),
            });
            await soloThomas(e);

            e.story.goToPassage(linkTo('village-thomas-walk', DeltaTime.fromMin(1)));
            const walk = await waitForLinear(e, 'village-thomas-walk');
            expect(walk.description).toBe('walk description');

            const actions = e.processor.getPossibleActions(walk);
            expect(actions).toEqual([{ text: 'Continue', passageId: 'village-thomas-next' }]);

            const before = s.time.s;
            e.story.goToPassage(actions[0]);
            await waitForPassage(e, 'village-thomas-next');
            expect(s.time.s).toBe(before);
        });

        it('offers no link without nextPassageId and stays put like a screen without links', async () => {
            const { e } = sessionWith({ 'village-thomas-walk': () => linear('walk') });
            await soloThomas(e);

            e.story.goToPassage(linkTo('village-thomas-walk', DeltaTime.fromMin(1)));
            const walk = await waitForLinear(e, 'village-thomas-walk');

            expect(e.processor.getPossibleActions(walk)).toEqual([]);
            expect(last(e.history.data.thomas!)).toMatchObject({ passageId: 'village-thomas-walk' });
        });

        it('auto-advances a non-main character to nextPassageId', async () => {
            const nextExecute = vi.fn();
            const { s, e } = sessionWith({
                'village-annie-walk': () => ({
                    ...linear('walk'),
                    characterId: 'annie',
                    nextPassageId: 'village-annie-next',
                }),
                'village-annie-next': () => ({ ...screen('next', { execute: nextExecute }), characterId: 'annie' }),
                'village-thomas-probe': () => screen('probe', {}),
            });
            e.history.data.annie = [{ passageId: 'village-annie-walk', time: s.time }];
            e.history.data.thomas = [
                { passageId: 'village-thomas-probe', time: s.time.moveToFutureBy(DeltaTime.fromMin(60)) },
            ];

            await e.processor.continue();
            await waitForPassage(e, 'village-thomas-probe');

            expect(nextExecute).toHaveBeenCalledTimes(1);
            expect(e.history.data.annie!.map((h) => ('passageId' in h ? h.passageId : h.reason))).toEqual([
                'village-annie-walk',
                'village-annie-next',
                'NO_ACTIONS',
            ]);
        });

        it('ends a non-main character with NO_ACTIONS when it has no nextPassageId', async () => {
            const { s, e } = sessionWith({
                'village-annie-walk': () => ({ ...linear('walk'), characterId: 'annie' }),
                'village-thomas-probe': () => screen('probe', {}),
            });
            e.history.data.annie = [{ passageId: 'village-annie-walk', time: s.time }];
            e.history.data.thomas = [
                { passageId: 'village-thomas-probe', time: s.time.moveToFutureBy(DeltaTime.fromMin(60)) },
            ];

            await e.processor.continue();
            await waitForPassage(e, 'village-thomas-probe');

            expect(last(e.history.data.annie!)).toMatchObject({ reason: 'NO_ACTIONS' });
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

        it('takes the link with the highest autoPriortiy, the first one on a tie', async () => {
            const highExecute = vi.fn();
            const { s, e } = sessionWith({
                'village-annie-choose': () => ({
                    ...screen('choose', {
                        body: [
                            {
                                links: [
                                    { text: 'default', passageId: 'village-annie-default' },
                                    { text: 'high', passageId: 'village-annie-high', autoPriortiy: 5 },
                                    { text: 'tie', passageId: 'village-annie-tie', autoPriortiy: 5 },
                                    { text: 'low', passageId: 'village-annie-low', autoPriortiy: 2 },
                                    { text: 'zero', passageId: 'village-annie-zero', autoPriortiy: 0 },
                                ],
                            },
                        ],
                    }),
                    characterId: 'annie',
                }),
                'village-annie-high': () => ({ ...screen('high', { execute: highExecute }), characterId: 'annie' }),
                'village-thomas-probe': () => screen('probe', {}),
            });
            e.history.data.annie = [{ passageId: 'village-annie-choose', time: s.time }];
            e.history.data.thomas = [
                { passageId: 'village-thomas-probe', time: s.time.moveToFutureBy(DeltaTime.fromMin(60)) },
            ];

            await e.processor.continue();
            await waitForPassage(e, 'village-thomas-probe');

            expect(highExecute).toHaveBeenCalledTimes(1);
        });
    });
});

describe('engine onLinkClick', () => {
    afterEach(() => {
        setToastHandler(() => {});
        vi.restoreAllMocks();
    });

    it('receives the link, its character and the parsed cost', async () => {
        const onLinkClick = vi.fn();
        const { s, e } = sessionWith({}, { onLinkClick });
        await soloThomas(e);

        const link = linkTo('village-thomas-forest', { time: DeltaTime.fromMin(10), tools: ['bow'] });
        e.story.goToPassage(link);
        await waitForPassage(e, 'village-thomas-forest');

        expect(onLinkClick).toHaveBeenCalledTimes(1);
        expect(onLinkClick).toHaveBeenCalledWith(
            { link, characterId: 'thomas', time: DeltaTime.fromMin(10), items: [], tools: ['bow'] },
            s,
            e
        );
    });

    it('runs for a link an auto-played character takes', async () => {
        const onLinkClick = vi.fn();
        const { s, e } = sessionWith(
            {
                'village-annie-probe': () => ({
                    ...screen('probe', {
                        body: [
                            { links: [{ text: 'rest', passageId: 'village-annie-rest', cost: DeltaTime.fromMin(5) }] },
                        ],
                    }),
                    characterId: 'annie',
                }),
                'village-annie-rest': () => ({ ...screen('rest', {}), characterId: 'annie' }),
                'village-thomas-probe': () => screen('probe', {}),
            },
            { onLinkClick }
        );
        e.history.data.annie = [{ passageId: 'village-annie-probe', time: s.time }];
        e.history.data.thomas = [
            { passageId: 'village-thomas-probe', time: s.time.moveToFutureBy(DeltaTime.fromMin(60)) },
        ];

        await e.processor.continue();
        await waitForPassage(e, 'village-thomas-probe');

        expect(onLinkClick).toHaveBeenCalledWith(
            expect.objectContaining({
                link: expect.objectContaining({ passageId: 'village-annie-rest' }),
                characterId: 'annie',
                time: DeltaTime.fromMin(5),
            }),
            s,
            e
        );
    });

    it('runs before the next passage is built', async () => {
        const { s, e } = sessionWith(
            {
                'village-thomas-next': (s) =>
                    screen('next', { body: [{ condition: s.characters.thomas.health === 7, text: 'saw it' }] }),
            },
            {
                onLinkClick: (_click, s) => {
                    s.characters.thomas.health = 7;
                },
            }
        );
        await soloThomas(e);

        e.story.goToPassage(linkTo('village-thomas-next', DeltaTime.fromMin(1)));
        const next = await waitForPassage(e, 'village-thomas-next');

        expect(next.body[0].condition).toBe(true);
        expect(s.characters.thomas.health).toBe(7);
    });

    it('leaves navigation unchanged without a hook', async () => {
        const { s, e } = sessionWith({});
        await soloThomas(e);
        const start = s.time.s;

        e.story.goToPassage(linkTo('village-thomas-forest', DeltaTime.fromMin(10)));
        await waitForPassage(e, 'village-thomas-forest');

        expect(s.time.s).toBe(start + DeltaTime.fromMin(10).s);
    });

    it('still navigates when the hook throws, and tells the player', async () => {
        const toast = vi.fn();
        setToastHandler(toast);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { e } = sessionWith(
            {},
            {
                onLinkClick: () => {
                    throw new Error('boom');
                },
            }
        );
        await soloThomas(e);

        e.story.goToPassage(linkTo('village-thomas-forest', DeltaTime.fromMin(10)));
        await waitForPassage(e, 'village-thomas-forest');

        expect(consoleError).toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith(expect.stringContaining('boom'), { variant: 'error' });
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

        // Thomas's village starts before Annie's kingdom.
        expect(e.history.getTurn().passageId).toBe('village-thomas-intro');

        // Book Thomas past Annie's start and she is now the one lagging.
        e.history.addTurn({ passageId: 'village-thomas-forest', time: s.time.moveToFutureBy(PAST_ANNIE_START) });
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
            tools: [],
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

        const passage = await waitForPassage(e, 'village-thomas-intro');
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

        const passage = await waitForPassage(e, 'village-thomas-intro');
        const hidden = {
            ...passage,
            body: [{ condition: false, links: passage.body[0].links }],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        expect(e.processor.getPossibleActions(hidden)).toHaveLength(0);
    });
});
