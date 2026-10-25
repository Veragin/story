import { expect, vi } from 'vitest';
import { DeltaTime } from '@story/shared';
import { buildWorldState, createWorldState, type Engine } from '@story/core';
import { itemInfo, register } from '@story/data';
import type { TWorldState } from '@story/data';
import type { TUnkownPassageScreen } from '@story/core';

export const TEST_STORY_ID = 'example';

export const newSession = (): { s: TWorldState; e: Engine } => createWorldState(register, itemInfo, TEST_STORY_ID);

// Annie's kingdom starts after Thomas's village: a walk this long lets her play exactly her first turn
export const PAST_ANNIE_START = DeltaTime.fromS(
    register.chapters.kingdom.timeRange.start.s - register.chapters.village.timeRange.start.s + DeltaTime.fromMin(10).s
);

export const newState = (): TWorldState => buildWorldState(register, itemInfo);

// `goToPassage` returns before the turn lands (passage modules are dynamic imports)
export const waitForPassage = async (e: Engine, passageId: string) => {
    await vi.waitFor(() => {
        expect(`${e.store.passage?.chapterId}-${e.store.passage?.characterId}-${e.store.passage?.id}`).toBe(passageId);
    });
    return e.store.passage as TUnkownPassageScreen;
};
