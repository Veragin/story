import { describe, expect, it } from 'vitest';
import { formatDiagnostic, NO_DIAGNOSTICS } from '../diagnostics';

describe('formatDiagnostic', () => {
    it('formats position and message', () => {
        expect(formatDiagnostic({ file: 'a.ts', line: 3, column: 7, message: 'Bad' })).toBe('a.ts:3:7 Bad');
    });

    it('prefixes the TS error code when present', () => {
        expect(formatDiagnostic({ file: 'a.ts', line: 1, column: 2, message: 'Nope', code: 2322 })).toBe(
            'a.ts:1:2 TS2322: Nope'
        );
    });
});

describe('NO_DIAGNOSTICS', () => {
    it('is empty', () => {
        expect(NO_DIAGNOSTICS).toEqual([]);
    });
});
