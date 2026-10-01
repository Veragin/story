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
import { keysOf } from '@story/shared';

/** Typed structurally: `core` must not depend on `data/` at value level. */
export type TWorldStateRegister = {
    characters: { readonly [Id in TCharacterId]: TCharacter<Id> };
    npcs: { readonly [Id in TNpcId]: TNpc<Id> };
    chapters: { readonly [Id in TChapterId]: TChapter<Id> };
    locations: { readonly [Id in TLocationId]: TLocation<Id> };
};

export type TItemInfoRegister = { readonly [Id in TItemId]: { readonly name: string } };

/** A chapter's lazy `<id>.passages.ts` module. */
export type TPassagesModule = {
    default: { readonly [passageId: string]: (s: TWorldState, e: Engine) => TChapterPassage<TChapterId> };
};

export type TStoryRegister = TWorldStateRegister & {
    passages: { readonly [Id in TChapterId]: () => Promise<TPassagesModule> };
};

/** The story, injected so the engine can run any story with this shape. */
export type TStoryModule = {
    register: TStoryRegister;
    itemInfo: TItemInfoRegister;
};

/** The story's authored starting state, without an `Engine` (which would load the saved game). */
export const buildWorldState = (register: TWorldStateRegister, itemInfo: TItemInfoRegister): TWorldState => {
    const ss = {
        time: storyStart(register),
        mainCharacterId: keysOf(register.characters)[0],
        currentHistory: {},

        characters: {} as Record<TCharacterId, unknown>,
        npcs: {} as Record<TNpcId, unknown>,
        chapters: {} as Record<TChapterId, unknown>,
        locations: {} as Record<TLocationId, unknown>,
    };

    keysOf(register.characters).forEach((id) => {
        const { inventory, ...rest } = register.characters[id].init;
        ss.characters[id] = {
            ...rest,
            inventory: inventory.map((i) => ({ ...itemInfo[i.id], ...i })),
            ref: register.characters[id],
        };
    });
    keysOf(register.npcs).forEach((id) => {
        const { inventory, ...rest } = register.npcs[id].init;
        ss.npcs[id] = {
            ...rest,
            inventory: inventory.map((i) => ({ ...itemInfo[i.id], ...i })),
            ref: register.npcs[id],
        };
    });
    keysOf(register.chapters).forEach((id) => {
        ss.chapters[id] = { ...register.chapters[id].init, ref: register.chapters[id] };
    });
    keysOf(register.locations).forEach((id) => {
        ss.locations[id] = { ...register.locations[id].init, ref: register.locations[id] };
    });
    return ss as TWorldState;
};

const storyStart = (register: TWorldStateRegister) =>
    (Object.values(register.chapters) as TChapter<TChapterId>[])
        .map((chapter) => chapter.timeRange.start)
        .reduce((earliest, start) => (start.isBefore(earliest) ? start : earliest));
