import { describe, expect, it } from 'vitest';
import { buildWorldState, copyWorldState, loadWorldState } from '@story/core';
import { itemInfo, register } from '@story/data';
import { DeltaTime, Time } from '@story/shared';

// `instanceof`, not `toEqual`: a plain `{ _timeS }` passes `toEqual` yet breaks the engine
describe('loadWorldState / copyWorldState', () => {
    it('revives the top-level clock as a real Time', () => {
        const s = buildWorldState(register, itemInfo);
        const copy = copyWorldState(s);

        expect(copy.time).toBeInstanceOf(Time);
        expect(copy.time.s).toBe(s.time.s);
        expect(copy.time.moveToFutureBy(DeltaTime.fromMin(1)).s).toBe(s.time.s + 60);
    });

    it('revives Times nested several objects deep', () => {
        const s = buildWorldState(register, itemInfo);
        const copy = copyWorldState(s);

        expect(copy.chapters.village.ref.timeRange.start).toBeInstanceOf(Time);
        expect(copy.chapters.village.ref.timeRange.end).toBeInstanceOf(Time);
        expect(copy.chapters.village.ref.timeRange.start.isEqual(register.chapters.village.timeRange.start)).toBe(true);
    });

    it('revives Times held inside arrays', () => {
        const s = buildWorldState(register, itemInfo);
        const copy = copyWorldState(s);

        const triggers = copy.chapters.village.ref.triggers;
        expect(triggers.length).toBeGreaterThan(0);
        for (const trigger of triggers) {
            expect(trigger.time).toBeInstanceOf(Time);
        }
        expect(triggers[0].time.isEqual(register.chapters.village.triggers[0].time)).toBe(true);
    });

    it('revives the Times recorded in currentHistory', () => {
        const s = buildWorldState(register, itemInfo);
        s.currentHistory.thomas = { passageId: 'village-thomas-intro', time: s.time };

        const copy = copyWorldState(s);

        expect(copy.currentHistory.thomas?.time).toBeInstanceOf(Time);
        expect(copy.currentHistory.thomas?.time.s).toBe(s.time.s);
    });

    it('revives DeltaTime as DeltaTime, not as Time', () => {
        // the reviver branches on the private field name, so the two must not be confused
        const revived = loadWorldState(
            JSON.stringify({
                nested: { cost: DeltaTime.fromMin(3) },
                inArray: [{ cost: DeltaTime.fromHour(2) }],
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any;

        expect(revived.nested.cost).toBeInstanceOf(DeltaTime);
        expect(revived.nested.cost).not.toBeInstanceOf(Time);
        expect(revived.nested.cost.min).toBe(3);
        expect(revived.inArray[0].cost).toBeInstanceOf(DeltaTime);
        expect(revived.inArray[0].cost.hour).toBe(2);
    });

    it('revives a zero Time — `_timeS: 0` is present, not absent', () => {
        // a truthiness check would miss `_timeS: 0`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const revived = loadWorldState(JSON.stringify({ t: Time.fromS(0) })) as any;

        expect(revived.t).toBeInstanceOf(Time);
        expect(revived.t.s).toBe(0);
    });

    it('leaves nulls and undefined alone instead of walking into them', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const revived = loadWorldState(JSON.stringify({ a: null, b: undefined, c: { d: null } })) as any;

        expect(revived.a).toBeNull();
        expect(revived).not.toHaveProperty('b');
        expect(revived.c.d).toBeNull();
    });

    it('copyWorldState detaches the copy from the original', () => {
        const s = buildWorldState(register, itemInfo);
        const copy = copyWorldState(s);

        expect(copy).not.toBe(s);
        expect(copy.characters.thomas).not.toBe(s.characters.thomas);
        expect(copy.characters.thomas.ref).not.toBe(s.characters.thomas.ref);

        copy.characters.thomas.health = 1;
        expect(s.characters.thomas.health).toBe(register.characters.thomas.init.health);
    });

    it('drops functions, because JSON does — a loaded ref is data, not a live register entry', () => {
        const s = buildWorldState(register, itemInfo);
        const copy = copyWorldState(s);

        expect(typeof register.chapters.village.triggers[0].condition).toBe('function');
        expect(copy.chapters.village.ref.triggers[0].condition).toBeUndefined();
        // hence `Processor` snapshots `chapter.ref` from the live register
    });

    describe('known gap: a bare array of Times is not revived', () => {
        it('leaves `Time[]` as plain objects', () => {
            // Pins a known gap: `Time` array elements are not revived; delete when fixed.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const revived = loadWorldState(JSON.stringify({ stamps: [Time.fromS(10), Time.fromS(20)] })) as any;

            expect(revived.stamps[0]).not.toBeInstanceOf(Time);
            expect(revived.stamps[0]).toEqual({ _timeS: 10 });
        });
    });
});
