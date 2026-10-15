import { describe, expect, it } from 'vitest';
import { buildWorldState } from '@story/core';
import { itemInfo, register } from '@story/data';
import { Time } from '@story/shared';
import { TEST_STORY_ID } from './support/engine';

describe('buildWorldState', () => {
    const MIRRORED_SLICES = ['characters', 'npcs', 'chapters', 'locations'] as const;

    it('populates every register slice, key for key', () => {
        const s = buildWorldState(register, itemInfo);

        for (const slice of MIRRORED_SLICES) {
            expect(Object.keys(s[slice]).sort(), `slice "${slice}"`).toEqual(Object.keys(register[slice]).sort());
            expect(Object.keys(s[slice]).length, `slice "${slice}" is empty`).toBeGreaterThan(0);
        }
    });

    it('points every entry"s ref at the register object it was built from', () => {
        const s = buildWorldState(register, itemInfo);

        for (const slice of MIRRORED_SLICES) {
            for (const id of Object.keys(register[slice])) {
                const entry = (s[slice] as Record<string, { ref?: unknown }>)[id];
                expect(entry.ref, `${slice}.${id}.ref`).toBe((register[slice] as Record<string, unknown>)[id]);
            }
        }
    });

    it('copies the init values of every entry onto the state', () => {
        const s = buildWorldState(register, itemInfo);

        expect(s.characters.thomas.health).toBe(register.characters.thomas.init.health);
        expect(s.characters.thomas.location).toBe('village');
        expect(s.npcs.franta.isDead).toBe(false);
        expect(s.chapters.village.mojePromena).toEqual(register.chapters.village.init.mojePromena);
        expect(s.locations.kingdom.ref.id).toBe('kingdom');
    });

    it('merges itemInfo into every starting inventory entry', () => {
        const s = buildWorldState(register, itemInfo);

        // static item data (name, …) must come from `itemInfo`
        expect(s.characters.thomas.inventory).toEqual([{ ...itemInfo.bow, id: 'bow', amount: 1 }]);
        expect(s.characters.annie.inventory).toEqual([{ ...itemInfo.berries, id: 'berries', amount: 10 }]);

        for (const character of Object.values(s.characters)) {
            for (const item of character.inventory) {
                expect(item.name, `item "${item.id}" has no name`).toBe(itemInfo[item.id].name);
                expect(item.amount).toBeGreaterThan(0);
            }
        }
    });

    it('gives each inventory entry its own object rather than aliasing itemInfo', () => {
        const a = buildWorldState(register, itemInfo);
        const b = buildWorldState(register, itemInfo);

        expect(a.characters.thomas.inventory[0]).not.toBe(b.characters.thomas.inventory[0]);
        expect(a.characters.thomas.inventory[0]).not.toBe(itemInfo.bow);

        a.characters.thomas.inventory[0].amount = 99;
        expect(b.characters.thomas.inventory[0].amount).toBe(1);
    });

    it('starts the clock at the earliest chapter start and the story at its first character', () => {
        const s = buildWorldState(register, itemInfo);

        expect(s.time).toBeInstanceOf(Time);
        // Village opens first in this story; no chapter is named by `buildWorldState` itself.
        const starts = Object.values(register.chapters).map((chapter) => chapter.timeRange.start.s);
        expect(s.time.s).toBe(Math.min(...starts));
        expect(s.time.isEqual(register.chapters.village.timeRange.start)).toBe(true);
        expect(s.mainCharacterId).toBe('thomas');
        expect(s.currentHistory).toEqual({});
    });

    it('builds a state with no Engine attached — no save is read, nothing is observable', () => {
        // the Visualizer must see the story as authored, so a seeded save is ignored
        localStorage.setItem(`worldState:${TEST_STORY_ID}`, JSON.stringify({ mainCharacterId: 'annie' }));

        const s = buildWorldState(register, itemInfo);

        expect(s.mainCharacterId).toBe('thomas');
    });

    describe('known defect: init is copied one level deep', () => {
        it('shares nested authored objects between the register and every built state', () => {
            // Pins a known defect (shallow spread shares nested `init`); delete when fixed.
            const a = buildWorldState(register, itemInfo);
            const b = buildWorldState(register, itemInfo);

            expect(a.chapters.village.mojePromena).toBe(register.chapters.village.init.mojePromena);
            expect(a.chapters.village.mojePromena).toBe(b.chapters.village.mojePromena);
        });
    });
});
