import { buildWorldState } from '@story/core';
import { itemInfo, register } from '@story/data';

/**
 * The pristine, authored starting state the passage graph renders against.
 *
 * Passage bodies are functions of `(s, e)`; the node/edge actualizers call them with this
 * state to read out titles, links and conditions. It must stay the *authored* base state —
 * `createWorldState` is the wrong tool here because it also constructs an `Engine`, which
 * replays whatever save sits in localStorage and would make the graph depend on how far the
 * player got.
 *
 * The state-building itself used to be duplicated here verbatim from `createWorldState`;
 * it now lives once in `@story/core`'s `buildWorldState`, which is the half of
 * `createWorldState` that runs before the `Engine` is constructed.
 */
export const worldStateCopy = buildWorldState(register, itemInfo);
