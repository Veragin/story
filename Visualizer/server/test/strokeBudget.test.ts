import { HttpException, HttpStatus } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import {
    DEFAULT_STROKE_BUDGET_BYTES,
    assertStrokeBudget,
    formatBytes,
    strokeBudgetBytes,
} from '../src/map/strokeBudget';
import { literal } from '../src/writer/TsWriterService';

/**
 * §4.3's stroke budget — the third of the three mitigations for "brush strokes are TypeScript"
 * (VISUALIZER_PLAN §7, Phase 5: "including … the `413` stroke budget").
 */

const originalBudget = process.env.VISUALIZER_STROKE_BUDGET_BYTES;

afterEach(() => {
    if (originalBudget === undefined) delete process.env.VISUALIZER_STROKE_BUDGET_BYTES;
    else process.env.VISUALIZER_STROKE_BUDGET_BYTES = originalBudget;
});

/** A stroke rendered the way `MapWriteController` renders it, with `points` points. */
const strokeSource = (points: number): string =>
    literal([
        {
            id: 'stroke-1',
            color: '#3f6fa8',
            width: 14,
            points: Array.from({ length: points * 2 }, (_, i) => i % 1000),
        },
    ]);

describe('budget resolution', () => {
    it('defaults to 2 MB, as §4.3 states', () => {
        delete process.env.VISUALIZER_STROKE_BUDGET_BYTES;
        expect(strokeBudgetBytes()).toBe(DEFAULT_STROKE_BUDGET_BYTES);
        expect(DEFAULT_STROKE_BUDGET_BYTES).toBe(2 * 1024 * 1024);
    });

    it('is configurable', () => {
        process.env.VISUALIZER_STROKE_BUDGET_BYTES = '4096';
        expect(strokeBudgetBytes()).toBe(4096);
    });

    it('falls back to the default for nonsense, rather than disabling itself', () => {
        // A budget of 0 or NaN would silently mean "reject everything" or "accept everything";
        // either is worse than ignoring the misconfiguration.
        process.env.VISUALIZER_STROKE_BUDGET_BYTES = 'not-a-number';
        expect(strokeBudgetBytes()).toBe(DEFAULT_STROKE_BUDGET_BYTES);
        process.env.VISUALIZER_STROKE_BUDGET_BYTES = '0';
        expect(strokeBudgetBytes()).toBe(DEFAULT_STROKE_BUDGET_BYTES);
        process.env.VISUALIZER_STROKE_BUDGET_BYTES = '-5';
        expect(strokeBudgetBytes()).toBe(DEFAULT_STROKE_BUDGET_BYTES);
    });
});

describe('enforcement', () => {
    it('accepts a realistic stroke and reports its size', () => {
        const source = strokeSource(200);
        const bytes = assertStrokeBudget(source, 'global');
        expect(bytes).toBe(Buffer.byteLength(source, 'utf8'));
        expect(bytes).toBeLessThan(DEFAULT_STROKE_BUDGET_BYTES);
    });

    it('accepts a payload exactly at the budget', () => {
        const source = 'x'.repeat(1000);
        expect(() => assertStrokeBudget(source, 'global', 1000)).not.toThrow();
    });

    it('rejects a payload one byte over the budget', () => {
        const source = 'x'.repeat(1001);
        expect(() => assertStrokeBudget(source, 'global', 1000)).toThrow(HttpException);
    });

    it('rejects with 413, not 400 or 500', () => {
        try {
            assertStrokeBudget('x'.repeat(100), 'global', 10);
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(HttpException);
            expect((error as HttpException).getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
        }
    });

    it('answers in the standard error envelope, and says what to do about it', () => {
        try {
            assertStrokeBudget('x'.repeat(5_000_000), 'global', DEFAULT_STROKE_BUDGET_BYTES);
            expect.unreachable('should have thrown');
        } catch (error) {
            const body = (error as HttpException).getResponse() as {
                success: boolean;
                error: string;
                bytes: number;
                budget: number;
            };
            expect(body.success).toBe(false);
            expect(body.error).toContain('global');
            expect(body.error).toContain('4.8 MB');
            expect(body.error).toContain('2.0 MB');
            // §4.3's own escape hatch, named in the message so the author has a next step.
            expect(body.error).toContain('background image');
            expect(body.bytes).toBe(5_000_000);
            expect(body.budget).toBe(DEFAULT_STROKE_BUDGET_BYTES);
        }
    });

    /** Measured in bytes, not characters: a multi-byte note id must not slip past the budget. */
    it('measures UTF-8 bytes rather than string length', () => {
        const multiByte = '—'.repeat(400); // 3 bytes each
        expect(multiByte.length).toBe(400);
        expect(() => assertStrokeBudget(multiByte, 'global', 500)).toThrow(HttpException);
    });

    /**
     * What the 2 MB default means in practice, measured rather than assumed: roughly 215 000
     * points per map at these coordinate magnitudes — about 10 bytes a point.
     *
     * That is the number worth knowing about §4.3's budget. It is far beyond anything the
     * client can produce, because `BrushStroke.finish` rounds and runs Ramer–Douglas–Peucker
     * before sending; reaching it means one of those did not happen, which is exactly the case
     * the budget exists to stop reaching `data/`.
     */
    it('accepts a hundred thousand points — the budget is not tight', () => {
        const bytes = assertStrokeBudget(strokeSource(100_000), 'global');
        expect(bytes).toBeGreaterThan(0.8 * 1024 * 1024);
        expect(bytes).toBeLessThan(DEFAULT_STROKE_BUDGET_BYTES);
    });

    it('rejects four hundred thousand points', () => {
        expect(() => assertStrokeBudget(strokeSource(400_000), 'global')).toThrow(HttpException);
    });

    it('accepts a realistically simplified stroke with room to spare', () => {
        expect(assertStrokeBudget(strokeSource(300), 'global')).toBeLessThan(10 * 1024);
    });
});

describe('formatBytes', () => {
    it('reads in kB below a megabyte and MB above', () => {
        expect(formatBytes(2048)).toBe('2 kB');
        expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
    });
});
