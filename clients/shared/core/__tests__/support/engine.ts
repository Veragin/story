import { expect, vi } from 'vitest';
import { DeltaTime, type TPassageId } from '@story/shared';
import { buildWorldState, createWorldState, type Engine } from '@story/core';
import { engine, itemInfo, register } from '@story/data';
import type { TWorldState } from '@story/data';
import type { TPlayablePassage, TUnkownPassageLinear, TUnkownPassageScreen } from '@story/core';
import type { TLink, TLinkCost } from '@story/types';

export const TEST_STORY_ID = 'example';

export const newSession = (): { s: TWorldState; e: Engine } =>
    createWorldState({ register, itemInfo, engine }, TEST_STORY_ID);

// Annie's kingdom starts after Thomas's village: a walk this long lets her play exactly her first turn
export const PAST_ANNIE_START = DeltaTime.fromS(
    register.chapters.kingdom.timeRange.start.s - register.chapters.village.timeRange.start.s + DeltaTime.fromMin(10).s
);

export const newState = (): TWorldState => buildWorldState(register, itemInfo);

// `goToPassage` returns before the turn lands (passage modules are dynamic imports)
const waitForStorePassage = (e: Engine, passageId: string): Promise<TPlayablePassage> =>
    vi.waitFor(() => {
        const passage = e.store.passage;
        expect(`${passage?.chapterId}-${passage?.characterId}-${passage?.id}`).toBe(passageId);
        if (passage === null) throw new Error(`${passageId} is not in the store`);
        return passage;
    });

export const waitForPassage = async (e: Engine, passageId: string): Promise<TUnkownPassageScreen> => {
    const passage = await waitForStorePassage(e, passageId);
    if (passage.type !== 'screen') throw new Error(`${passageId} is a ${passage.type} passage, not a screen`);
    return passage;
};

export const waitForLinear = async (e: Engine, passageId: string): Promise<TUnkownPassageLinear> => {
    const passage = await waitForStorePassage(e, passageId);
    if (passage.type !== 'linear') throw new Error(`${passageId} is a ${passage.type} passage, not a linear one`);
    return passage;
};

export const linkTo = (passageId: TPassageId, cost?: TLinkCost, onFinish?: () => void): TLink<TPassageId> => ({
    text: passageId,
    passageId,
    cost,
    onFinish,
});
