import { expect, vi } from 'vitest';
import { buildWorldState, createWorldState, type Engine } from '@story/core';
import { itemInfo, register } from '@story/data';
import type { TWorldState } from '@story/data';
import type { TUnkownPassageScreen } from '@story/core';

/** A fresh, unsaved play session over the real story. */
export const newSession = (): { s: TWorldState; e: Engine } => createWorldState(register, itemInfo);

/** A pristine, engine-less world state over the real story. */
export const newState = (): TWorldState => buildWorldState(register, itemInfo);

/**
 * `Story.goToPassage` fires `Processor.continue()` and returns immediately — the passage
 * modules behind `register.passages` are dynamic imports, so the turn lands a few microtasks
 * later and there is no promise to await. Rather than sprinkle arbitrary sleeps, wait for the
 * observable outcome: the store holding the passage we asked for.
 */
export const waitForPassage = async (e: Engine, passageId: string) => {
    await vi.waitFor(() => {
        expect(`${e.store.passage?.chapterId}-${e.store.passage?.characterId}-${e.store.passage?.id}`).toBe(passageId);
    });
    return e.store.passage as TUnkownPassageScreen;
};
