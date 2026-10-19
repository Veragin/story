import { describe, expect, it } from 'vitest';
import { isCostItem, parseCost, parseDelta } from '../editor/costCode';

describe('parseDelta', () => {
    it('reads the DeltaTime factories', () => {
        expect(parseDelta('DeltaTime.fromMin(10)')).toEqual({ seconds: 600 });
        expect(parseDelta('DeltaTime.fromS(30)')).toEqual({ seconds: 30 });
        expect(parseDelta('DeltaTime.fromHour(2)')).toEqual({ seconds: 7200 });
        expect(parseDelta('x')).toBeUndefined();
    });
});

describe('parseCost', () => {
    it('reads a time-only cost', () => {
        expect(parseCost('DeltaTime.fromMin(1)')).toEqual({ seconds: 60 });
    });

    it('reads a cost object, keeping code it cannot read', () => {
        expect(
            parseCost("{ time: DeltaTime.fromMin(2), items: [{ id: 'bread', amount: 2 }], tools: ['axe'] }")
        ).toEqual({ time: { seconds: 120 }, items: [{ id: 'bread', amount: 2 }], tools: ['axe'] });
        expect(parseCost('{ time: later(), items: pick() }')).toEqual({
            time: { code: 'later()' },
            items: { code: 'pick()' },
        });
    });

    it('refuses anything that is not a cost', () => {
        expect(parseCost('s.time.s < 10 ? DeltaTime.fromMin(1) : DeltaTime.fromMin(2)')).toBeUndefined();
        expect(parseCost('{ speed: 1 }')).toBeUndefined();
        expect(parseCost("{ items: [{ id: 'bread' }] }")).toBeUndefined();
        expect(parseCost('{ tools: [1] }')).toBeUndefined();
    });
});

describe('isCostItem', () => {
    it('accepts exactly an id and an amount', () => {
        expect(isCostItem({ id: 'bread', amount: 1 })).toBe(true);
        expect(isCostItem({ id: 'bread', amount: '1' })).toBe(false);
        expect(isCostItem({ code: 'x' })).toBe(false);
    });
});
