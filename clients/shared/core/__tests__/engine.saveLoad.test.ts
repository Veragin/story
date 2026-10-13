import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorldState } from '@story/core';
import { DeltaTime, setToastHandler, Time } from '@story/shared';
import { itemInfo, register } from '@story/data';
import { newSession, TEST_STORY_ID, waitForPassage } from './support/engine';
import { installLocalStorageStub } from './support/localStorage';

// private to `Engine`, pinned here
const LOCAL_STORAGE_KEY = `worldState:${TEST_STORY_ID}`;

const playOneTurn = async () => {
    const session = newSession();
    await session.e.processor.continue();
    session.e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10));
    await waitForPassage(session.e, 'village-thomas-forest');
    return session;
};

afterEach(() => {
    setToastHandler(() => {});
});

describe('Engine save/load', () => {
    it('writes the whole world state under a single key', async () => {
        const { s, e } = await playOneTurn();

        e.saveStateToLocalStorage();

        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        expect(raw).toBeTypeOf('string');
        expect(JSON.parse(raw!)).toEqual(JSON.parse(JSON.stringify(s)));
    });

    it('announces the save through the toast port rather than importing a UI', async () => {
        const toast = vi.fn();
        setToastHandler(toast);
        const { e } = await playOneTurn();

        e.saveStateToLocalStorage();

        expect(toast).toHaveBeenCalledWith('Game was saved', { variant: 'success' });
    });

    it('clears the save', async () => {
        const { e } = await playOneTurn();
        e.saveStateToLocalStorage();

        e.clearStateFromLocalStorage();

        expect(localStorage.getItem(LOCAL_STORAGE_KEY)).toBeNull();
    });

    it('starts a pristine session when there is nothing saved', () => {
        const { s, e } = newSession();

        expect(s.time.isEqual(register.chapters.village.timeRange.start)).toBe(true);
        expect(s.currentHistory).toEqual({});
        expect(e.history.data.thomas).toHaveLength(1);
    });

    it('restores the clock and the pending turns into the next session', async () => {
        const first = await playOneTurn();
        first.e.saveStateToLocalStorage();

        // A new session over a *pristine* state: the constructor is what replays the save.
        const second = newSession();

        expect(second.s.time.s).toBe(first.s.time.s);
        expect(second.s.currentHistory.thomas).toMatchObject({ passageId: 'village-thomas-forest' });
        expect(second.s.characters.thomas.health).toBe(first.s.characters.thomas.health);
        expect(second.s.characters.annie.inventory[0].amount).toBe(first.s.characters.annie.inventory[0].amount);
    });

    it('revives the restored Times as Time instances, not as plain JSON objects', async () => {
        const first = await playOneTurn();
        first.e.saveStateToLocalStorage();

        const second = newSession();

        expect(second.s.time).toBeInstanceOf(Time);
        expect(second.s.currentHistory.thomas?.time).toBeInstanceOf(Time);
        expect(second.e.history.data.thomas![0].time).toBeInstanceOf(Time);
    });

    it('seeds History from the restored save, so the session resumes mid-story', async () => {
        const first = await playOneTurn();
        first.e.saveStateToLocalStorage();

        const second = newSession();
        // the save is loaded before `History` is built, so the saved turn wins
        expect(second.e.history.data.thomas![0]).toMatchObject({ passageId: 'village-thomas-forest' });

        await second.e.handleAutoStart();
        expect(second.e.store.passage?.id).toBe('forest');
    });

    it('mutates the state object in place instead of swapping it out', async () => {
        const first = await playOneTurn();
        first.e.saveStateToLocalStorage();

        // apps keep the `s` reference forever, so loading must not replace it
        const second = createWorldState(register, itemInfo, TEST_STORY_ID);
        expect(second.s.time.s).toBe(first.s.time.s);

        const held = second.s;
        second.e.clearStateFromLocalStorage();
        expect(second.s).toBe(held);
    });

    it('keeps one save per story id, so two stories never resume each other', async () => {
        const { e } = await playOneTurn();
        e.saveStateToLocalStorage();

        const other = createWorldState(register, itemInfo, 'another-story');
        expect(other.s.currentHistory).toEqual({});

        other.e.clearStateFromLocalStorage();
        expect(localStorage.getItem(LOCAL_STORAGE_KEY)).not.toBeNull();
    });

    it('ignores a save whose key does not match', async () => {
        const { e } = await playOneTurn();
        e.saveStateToLocalStorage();
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY)!;
        localStorage.clear();
        localStorage.setItem('someOtherKey', saved);

        const { s } = newSession();

        expect(s.currentHistory).toEqual({});
    });

    describe('known defect: a restored `ref` is dead data, not the register entry', () => {
        it('loses the callbacks on every ref it round-trips through JSON', async () => {
            // Pins a known defect: refs lose their callbacks through JSON, so resumed triggers crash; delete when fixed.
            const first = await playOneTurn();
            first.e.saveStateToLocalStorage();

            const second = newSession();

            expect(typeof register.chapters.village.triggers[0].condition).toBe('function');
            expect(second.s.chapters.village.ref).not.toBe(register.chapters.village);
            expect(second.s.chapters.village.ref.triggers[0].condition).toBeUndefined();
            expect(second.s.characters.thomas.ref).not.toBe(register.characters.thomas);
        });
    });

    describe('known defect: core reaches for the localStorage global directly', () => {
        it('cannot construct an Engine in a plain node process', () => {
            // `@story/core` is meant to be headless and to run inside the future MultiEngine
            // node server (REFACTOR_PLAN §2), but `Engine`'s constructor calls
            // `loadStateFromLocalStorage`, which reads a bare `localStorage`. `@types/node`
            // declares that identifier, so `tsc` is happy and the failure is runtime-only.
            //
            // This is *not* a reason to run the `core` tests under jsdom — a DOM is not the
            // dependency, one browser storage API is. The fix is an injected save-store port
            // (same shape as `setToastHandler`); until then the test suite stubs the global
            // in `core/__tests__/setup.ts` and this test states the constraint out loud.
            vi.unstubAllGlobals();
            expect('localStorage' in globalThis).toBe(false);

            expect(() => createWorldState(register, itemInfo, TEST_STORY_ID)).toThrow(ReferenceError);
            expect(() => createWorldState(register, itemInfo, TEST_STORY_ID)).toThrow(/localStorage is not defined/);

            installLocalStorageStub();
            expect(() => createWorldState(register, itemInfo, TEST_STORY_ID)).not.toThrow();
        });
    });
});
