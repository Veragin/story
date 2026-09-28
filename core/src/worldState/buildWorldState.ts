import type { TWorldState } from '@story/data';
import type {
    TChapter,
    TChapterId,
    TCharacter,
    TCharacterId,
    TItemId,
    TLocation,
    TLocationId,
    TNpc,
    TNpcId,
} from '@story/types';

/**
 * Structural shape of `data/register` — only the slices the world state is built from.
 * Typed structurally on purpose: this module must not depend on `data/` at value level.
 */
export type TWorldStateRegister = {
    characters: { readonly [Id in TCharacterId]: TCharacter<Id> };
    npcs: { readonly [Id in TNpcId]: TNpc<Id> };
    chapters: { readonly [Id in TChapterId]: TChapter<Id> };
    locations: { readonly [Id in TLocationId]: TLocation<Id> };
};

/** Structural shape of `data/items/itemInfo` — the static per-item data merged into inventories. */
export type TItemInfoRegister = { readonly [Id in TItemId]: object };

/**
 * Builds a pristine world state from the story register: every character, NPC,
 * chapter and location at its `init` values, with a `ref` back to its definition.
 *
 * Deliberately *does not* construct an `Engine`. An `Engine` loads any saved game out of
 * localStorage and mutates the state it is given, which is right for a play session and wrong
 * for anything that needs the story's starting point — the Visualizer's passage graph renders
 * passage bodies against this base state so the graph shows the story as authored, not as the
 * last player left it. `createWorldState` is the play-session wrapper on top of this.
 */
export const buildWorldState = (register: TWorldStateRegister, itemInfo: TItemInfoRegister): TWorldState => {
    const ss = {
        time: register.chapters.village.timeRange.start,
        mainCharacterId: 'thomas',
        currentHistory: {},

        characters: {} as Record<TCharacterId, unknown>,
        npcs: {} as Record<TNpcId, unknown>,
        chapters: {} as Record<TChapterId, unknown>,
        locations: {} as Record<TLocationId, unknown>,
    };

    (Object.keys(register.characters) as TCharacterId[]).forEach((id) => {
        const { inventory, ...rest } = register.characters[id].init;
        ss.characters[id] = {
            ...rest,
            inventory: inventory.map((i) => ({ ...itemInfo[i.id], ...i })),
            ref: register.characters[id],
        };
    });
    (Object.keys(register.npcs) as TNpcId[]).forEach((id) => {
        const { inventory, ...rest } = register.npcs[id].init;
        ss.npcs[id] = {
            ...rest,
            inventory: inventory.map((i) => ({ ...itemInfo[i.id], ...i })),
            ref: register.npcs[id],
        };
    });
    (Object.keys(register.chapters) as TChapterId[]).forEach((id) => {
        ss.chapters[id] = { ...register.chapters[id].init, ref: register.chapters[id] };
    });
    (Object.keys(register.locations) as TLocationId[]).forEach((id) => {
        ss.locations[id] = { ...register.locations[id].init, ref: register.locations[id] };
    });
    return ss as TWorldState;
};
