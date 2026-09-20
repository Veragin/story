import { describe, expect, it } from 'vitest';
import { DeltaTime } from '@story/shared';
import { itemInfo } from '@story/data';
import { newSession, waitForPassage } from './support/engine';

/**
 * Inventory is the only place item *amounts* are written, and every write is silent: nothing
 * validates that an item exists, that an amount is positive, or that the character being
 * charged is the one the caller meant. The character defaults to
 * `engine.activePassage.characterId`, which before the first turn is `DUMMY_PASSAGE`'s —
 * Thomas. These tests state that default explicitly so a change to `DUMMY_PASSAGE` shows up
 * here rather than as items appearing in the wrong bag.
 */
describe('Inventory', () => {
    it('reads the active character"s bag by default', () => {
        const { s, e } = newSession();

        expect(e.inventory.getInventory()).toBe(s.characters.thomas.inventory);
        expect(e.inventory.getInventory('annie')).toBe(s.characters.annie.inventory);
    });

    it('reports amounts, and zero for an item that is not held', () => {
        const { e } = newSession();

        expect(e.inventory.getItemAmount('bow')).toBe(1);
        expect(e.inventory.getItemAmount('axe')).toBe(0);
        expect(e.inventory.getItemAmount('berries')).toBe(0);
        expect(e.inventory.getItemAmount('berries', 'annie')).toBe(10);
        expect(e.inventory.getItem('axe')).toBeUndefined();
    });

    it('adds a new item with its itemInfo merged in and an amount of 1 by default', () => {
        const { s, e } = newSession();

        e.inventory.addItem({ id: 'axe' });

        const axe = e.inventory.getItem('axe');
        expect(axe).toMatchObject({ ...itemInfo.axe, id: 'axe', amount: 1 });
        expect(s.characters.thomas.inventory).toHaveLength(2);
    });

    it('honours an explicit amount on a new item', () => {
        const { e } = newSession();

        e.inventory.addItem({ id: 'wood', amount: 7 });

        expect(e.inventory.getItemAmount('wood')).toBe(7);
        expect(e.inventory.getItem('wood')?.name).toBe(itemInfo.wood.name);
    });

    it('stacks onto an item already held instead of adding a second entry', () => {
        const { s, e } = newSession();

        e.inventory.addItem({ id: 'bow', amount: 2 });
        e.inventory.addItem({ id: 'bow' });

        expect(e.inventory.getItemAmount('bow')).toBe(4);
        expect(s.characters.thomas.inventory).toHaveLength(1);
    });

    it('decrements on remove and keeps the entry while some remain', () => {
        const { e } = newSession();
        e.inventory.addItem({ id: 'wood', amount: 5 });

        e.inventory.removeItem({ id: 'wood', amount: 2 });

        expect(e.inventory.getItemAmount('wood')).toBe(3);
        expect(e.inventory.getItem('wood')).toBeDefined();
    });

    it('drops the entry entirely once the last one is spent', () => {
        const { s, e } = newSession();

        e.inventory.removeItem({ id: 'bow', amount: 1 });

        expect(e.inventory.getItem('bow')).toBeUndefined();
        expect(e.inventory.getItemAmount('bow')).toBe(0);
        expect(s.characters.thomas.inventory).toHaveLength(0);
    });

    it('drops the entry rather than going negative when more is spent than held', () => {
        const { e } = newSession();

        e.inventory.removeItem({ id: 'bow', amount: 99 });

        expect(e.inventory.getItemAmount('bow')).toBe(0);
    });

    it('ignores a removal of something the character does not have', () => {
        const { s, e } = newSession();

        expect(() => e.inventory.removeItem({ id: 'axe', amount: 1 })).not.toThrow();
        expect(s.characters.thomas.inventory).toHaveLength(1);
    });

    it('removes from the character it is told to, not the active one', () => {
        const { s, e } = newSession();

        e.inventory.removeItem({ id: 'berries', amount: 4 }, 'annie');

        expect(e.inventory.getItemAmount('berries', 'annie')).toBe(6);
        expect(s.characters.thomas.inventory).toHaveLength(1);
    });

    it('charges a link"s item cost when the turn it belongs to is played', async () => {
        const { s, e } = newSession();

        // Annie's `kingdom-annie-intro → palace` link costs one berry, and she is auto-played
        // by the processor while Thomas walks to the forest.
        expect(s.characters.annie.inventory[0].amount).toBe(10);

        await e.processor.continue();
        e.story.goToPassage('village-thomas-forest', DeltaTime.fromMin(10));
        await waitForPassage(e, 'village-thomas-forest');

        expect(e.inventory.getItemAmount('berries', 'annie')).toBe(9);
    });

    describe('known defect: addItem ignores its charId when the item is new', () => {
        it('puts a brand-new item in the active character"s bag whoever was named', () => {
            // `Inventory.addItem` looks the item up with the `charId` it was given, but pushes
            // with `this.getInventory()` — no argument, so the *default* character. Stacking
            // onto an item the named character already holds works; giving them a new one
            // does not. Nothing in the story hits this today (every `addItem` call site uses
            // the default), which is exactly why it would stay hidden.
            //
            // Pinned, not fixed: the fix is `this.getInventory(charId).push(...)` in
            // `core/src/engine/Inventory.ts`, a source change outside this phase. If this test
            // goes red, the defect is fixed — delete the block.
            const { s, e } = newSession();

            e.inventory.addItem({ id: 'axe' }, 'annie');

            expect(e.inventory.getItemAmount('axe', 'annie')).toBe(0);
            expect(e.inventory.getItemAmount('axe', 'thomas')).toBe(1);
            expect(s.characters.thomas.inventory.map((i) => i.id)).toContain('axe');
        });

        it('does stack correctly onto an item the named character already holds', () => {
            const { e } = newSession();

            e.inventory.addItem({ id: 'berries', amount: 5 }, 'annie');

            expect(e.inventory.getItemAmount('berries', 'annie')).toBe(15);
        });
    });
});
