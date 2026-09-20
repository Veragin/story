import type { TWorldState } from 'data/TWorldState';
import type {
    TChapter,
    TChapterId,
    TCharacter,
    TCharacterId,
    THappening,
    THappeningId,
    TItemId,
    TLocation,
    TLocationId,
    TSideCharacter,
    TSideCharacterId,
} from '@story/types';
import { Engine } from 'code/Engine/ts/Engine';

/**
 * Structural shape of `data/register` — only the slices the world state is built from.
 * Typed structurally on purpose: this module must not depend on `data/` at value level.
 */
export type TWorldStateRegister = {
    characters: { readonly [Id in TCharacterId]: TCharacter<Id> };
    sideCharacters: { readonly [Id in TSideCharacterId]: TSideCharacter<Id> };
    chapters: { readonly [Id in TChapterId]: TChapter<Id> };
    locations: { readonly [Id in TLocationId]: TLocation<Id> };
    happenings: { readonly [Id in THappeningId]: THappening<Id> };
};

/** Structural shape of `data/items/itemInfo` — the static per-item data merged into inventories. */
export type TItemInfoRegister = { readonly [Id in TItemId]: object };

/**
 * Builds a fresh world state from the story register and an `Engine` driving it.
 *
 * Pure factory: no module-level side effects, no `window` writes, no auto start —
 * the calling app owns those.
 */
export const createWorldState = (
    register: TWorldStateRegister,
    itemInfo: TItemInfoRegister
): { s: TWorldState; e: Engine } => {
    const ss = {
        time: register.chapters.village.timeRange.start,
        mainCharacterId: 'thomas',
        currentHistory: {},

        characters: {} as Record<TCharacterId, unknown>,
        sideCharacters: {} as Record<TSideCharacterId, unknown>,
        chapters: {} as Record<TChapterId, unknown>,
        locations: {} as Record<TLocationId, unknown>,
        happenings: {} as Record<THappeningId, unknown>,
    };

    (Object.keys(register.characters) as TCharacterId[]).forEach((id) => {
        const { inventory, ...rest } = register.characters[id].init;
        ss.characters[id] = {
            ...rest,
            inventory: inventory.map((i) => ({ ...itemInfo[i.id], ...i })),
            ref: register.characters[id],
        };
    });
    (Object.keys(register.sideCharacters) as TSideCharacterId[]).forEach((id) => {
        const { inventory, ...rest } = register.sideCharacters[id].init;
        ss.sideCharacters[id] = {
            ...rest,
            inventory: inventory.map((i) => ({ ...itemInfo[i.id], ...i })),
            ref: register.sideCharacters[id],
        };
    });
    (Object.keys(register.chapters) as TChapterId[]).forEach((id) => {
        ss.chapters[id] = { ...register.chapters[id].init, ref: register.chapters[id] };
    });
    (Object.keys(register.locations) as TLocationId[]).forEach((id) => {
        ss.locations[id] = { ...register.locations[id].init, ref: register.locations[id] };
    });
    (Object.keys(register.happenings) as THappeningId[]).forEach((id) => {
        ss.happenings[id] = { ...register.happenings[id].init, ref: register.happenings[id] };
    });

    const s = ss as TWorldState;
    const e = new Engine(s);

    return { s, e };
};
