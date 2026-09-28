import { describe, expect, it } from 'vitest';
import { buildWorldState } from '@story/core';
import { itemInfo, register } from '@story/data';
import { Time } from '@story/shared';

/**
 * `buildWorldState` turns the authored register into the pristine world state. It is a loop
 * per register slice, which is exactly the shape that rots quietly: a slice whose loop is
 * simply absent fails nothing until a passage reads `s.<slice>.<id>`. The first test below is
 * the regression lock for that class of bug — it is driven off `register`'s own keys, so a
 * *new* slice that nobody wired up fails here too.
 */
describe('buildWorldState', () => {
    /** Every register slice that the world state is expected to mirror one-for-one. */
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

        // `init.inventory` is `TItemPartial` — `{ id, amount }` and nothing else. The static
        // per-item data (name/type/damage) has to come from `itemInfo` or the UI renders a
        // nameless item and `Story`'s "You have spent: …" toast prints `undefined`.
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

    it('starts the clock at the first chapter"s start and the story at its main character', () => {
        const s = buildWorldState(register, itemInfo);

        expect(s.time).toBeInstanceOf(Time);
        expect(s.time.isEqual(register.chapters.village.timeRange.start)).toBe(true);
        expect(s.mainCharacterId).toBe('thomas');
        expect(s.currentHistory).toEqual({});
    });

    it('builds a state with no Engine attached — no save is read, nothing is observable', () => {
        // The Visualizer renders passage bodies against this state and must see the story as
        // authored, not as the last player left it. Seed a save and prove it is ignored.
        localStorage.setItem('worldState', JSON.stringify({ mainCharacterId: 'annie' }));

        const s = buildWorldState(register, itemInfo);

        expect(s.mainCharacterId).toBe('thomas');
    });

    describe('known defect: init is copied one level deep', () => {
        it('shares nested authored objects between the register and every built state', () => {
            // `{ ...register.chapters[id].init }` is a shallow spread, so anything nested in
            // `init` is the *same object* in the register, in a Visualizer preview state and
            // in a live play session. Writing to it from one leaks into the others and, worse,
            // mutates the authored story for the rest of the process.
            //
            // Pinned rather than fixed: the fix is a deep clone in `buildWorldState`, which is
            // a `core` source change and out of scope for the Vitest phase. If this test ever
            // goes red because the objects are no longer shared, the defect is fixed — delete
            // this block rather than adapting it.
            const a = buildWorldState(register, itemInfo);
            const b = buildWorldState(register, itemInfo);

            expect(a.chapters.village.mojePromena).toBe(register.chapters.village.init.mojePromena);
            expect(a.chapters.village.mojePromena).toBe(b.chapters.village.mojePromena);
        });
    });
});
