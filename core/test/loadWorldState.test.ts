import { describe, expect, it } from 'vitest';
import { buildWorldState, copyWorldState, loadWorldState } from '@story/core';
import { itemInfo, register } from '@story/data';
import { DeltaTime, Time } from '@story/shared';

/**
 * The save format is `JSON.stringify(worldState)`, which flattens every `Time` / `DeltaTime`
 * into a bare `{ _timeS }` / `{ _deltaTimeS }`. `replaceTime` walks the parsed object and
 * revives them — and if it misses one, nothing throws at load time. The failure surfaces
 * later and somewhere else, as `s.time.moveToFutureBy is not a function` deep inside a turn,
 * or as an `isBefore` comparison against an object that has no `.s`.
 *
 * So these tests assert on `instanceof`, not on value equality: a plain object with the right
 * `_timeS` passes a `toEqual` and still breaks the engine.
 */
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

        // chapters.<id>.ref.timeRange.{start,end} — four levels down from the root.
        expect(copy.chapters.village.ref.timeRange.start).toBeInstanceOf(Time);
        expect(copy.chapters.village.ref.timeRange.end).toBeInstanceOf(Time);
        expect(copy.chapters.village.ref.timeRange.start.isEqual(register.chapters.village.timeRange.start)).toBe(true);
    });

    it('revives Times held inside arrays', () => {
        const s = buildWorldState(register, itemInfo);
        const copy = copyWorldState(s);

        // chapters.village.ref.triggers is an array of objects, each with a `time`.
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
        // Nothing in the authored world state carries a DeltaTime today, but `TLinkCost` does
        // and the reviver branches on the private field name — so the two must not be confused.
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
        // The reviver tests `_timeS !== undefined`; a truthiness check here would leave the
        // very first second of the story as a plain object.
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

        // `register.chapters.village.triggers[0]` has `condition`/`action` callbacks.
        expect(typeof register.chapters.village.triggers[0].condition).toBe('function');
        expect(copy.chapters.village.ref.triggers[0].condition).toBeUndefined();
        // Which is why `Processor` snapshots `chapter.ref` from the *live* register at
        // construction time and never off a reloaded state.
    });

    describe('known gap: a bare array of Times is not revived', () => {
        it('leaves `Time[]` as plain objects', () => {
            // `replaceTime` recurses into array *elements*, but the element of a `Time[]` is
            // the serialized Time itself — and the reviver only replaces a `_timeS` holder
            // when it finds it as a *property* of the object it is walking, never as the
            // object it was handed. No authored type holds a `Time[]` today, so this is a
            // trap rather than a live bug; it is pinned here so that adding one is a caught
            // mistake rather than a runtime surprise. Fix is in `replaceTime`, out of scope
            // for this phase — if this goes red, the gap is closed: delete this block.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const revived = loadWorldState(JSON.stringify({ stamps: [Time.fromS(10), Time.fromS(20)] })) as any;

            expect(revived.stamps[0]).not.toBeInstanceOf(Time);
            expect(revived.stamps[0]).toEqual({ _timeS: 10 });
        });
    });
});
