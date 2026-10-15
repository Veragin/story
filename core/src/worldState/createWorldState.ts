import type { TWorldState } from '@story/data';
import { buildWorldState, type TItemInfoRegister, type TStoryRegister } from './buildWorldState';
import { Engine } from '../engine/Engine';

/** A play session: `storyId` namespaces its localStorage save. */
export const createWorldState = (
    register: TStoryRegister,
    itemInfo: TItemInfoRegister,
    storyId: string
): { s: TWorldState; e: Engine } => {
    const s = buildWorldState(register, itemInfo);
    const e = new Engine(s, { register, itemInfo }, storyId);

    return { s, e };
};
