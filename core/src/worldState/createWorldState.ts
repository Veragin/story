import type { TWorldState } from 'data/TWorldState';
import { buildWorldState, type TItemInfoRegister, type TWorldStateRegister } from './buildWorldState';
import { Engine } from '../engine/Engine';

/**
 * Builds a fresh world state from the story register, plus an `Engine` driving it.
 *
 * The state itself comes from {@link buildWorldState}; the only thing added here is the
 * `Engine`, which makes the state observable and replays any saved game from localStorage
 * over it. Callers that want the authored starting state and no play session — the
 * Visualizer's passage graph — call `buildWorldState` directly.
 *
 * Pure factory: no module-level side effects, no `window` writes, no auto start —
 * the calling app owns those.
 */
export const createWorldState = (
    register: TWorldStateRegister,
    itemInfo: TItemInfoRegister
): { s: TWorldState; e: Engine } => {
    const s = buildWorldState(register, itemInfo);
    const e = new Engine(s);

    return { s, e };
};
