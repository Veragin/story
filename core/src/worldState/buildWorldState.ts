import type { TWorldState } from '@story/data';
import type { Engine } from '../engine/Engine';
import type {
    TChapter,
    TChapterId,
    TChapterPassage,
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
 * Typed structurally on purpose: `core` must not depend on `data/` at value level.
 */
export type TWorldStateRegister = {
    characters: { readonly [Id in TCharacterId]: TCharacter<Id> };
    npcs: { readonly [Id in TNpcId]: TNpc<Id> };
    chapters: { readonly [Id in TChapterId]: TChapter<Id> };
    locations: { readonly [Id in TLocationId]: TLocation<Id> };
};

/**
 * Structural shape of `data/items/itemInfo` — the static per-item data merged into inventories.
 * `name` is the one field the engine itself reads (the "you have spent" toast, link costs).
 */
export type TItemInfoRegister = { readonly [Id in TItemId]: { readonly name: string } };

/**
 * Structural shape of a chapter's lazy passage module: `data/chapters/<id>/<id>.passages.ts`,
 * whose default export maps every passage id of the chapter to its passage function.
 */
export type TPassagesModule = {
    default: { readonly [passageId: string]: (s: TWorldState, e: Engine) => TChapterPassage<TChapterId> };
};

/** Structural shape of the whole `data/register`: the world-state slices plus the lazy passages. */
export type TStoryRegister = TWorldStateRegister & {
    passages: { readonly [Id in TChapterId]: () => Promise<TPassagesModule> };
};

/**
 * Everything the engine needs from a story at runtime, handed to it instead of imported.
 * `core` imports `@story/data` type-only, so the same engine can run any story whose
 * `register` / `itemInfo` have this shape — the caller (SingleEngine, a test, the future
 * MultiEngine server) is the one that imports the story. `Engine` exposes it as
 * `engine.storyModule`.
 */
export type TStoryModule = {
    register: TStoryRegister;
    itemInfo: TItemInfoRegister;
};

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
        time: storyStart(register),
        // The first registered character: the SingleEngine default until the player picks one.
        mainCharacterId: (Object.keys(register.characters) as TCharacterId[])[0],
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

/**
 * The clock starts at the earliest `timeRange.start` over all chapters: the first moment
 * anything in the story can happen. Nothing names a chapter, so any story's register works.
 */
const storyStart = (register: TWorldStateRegister) =>
    (Object.values(register.chapters) as TChapter<TChapterId>[])
        .map((chapter) => chapter.timeRange.start)
        .reduce((earliest, start) => (start.isBefore(earliest) ? start : earliest));
