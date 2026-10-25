import type { TDiagnosticDto } from '@story/protocol';
import { describe, expect, it } from 'vitest';
import { newDiagnostics } from '../src/project/validate';

const d = (line: number, message: string, file = 'data/locations/home.location.ts'): TDiagnosticDto => ({
    file,
    line,
    column: 38,
    message,
    code: 2344,
});

describe('newDiagnostics', () => {
    it('ignores an old error that moved', () => {
        expect(newDiagnostics([d(3, 'a')], [d(9, 'a')])).toEqual([]);
    });

    it('ignores an old error whose message quotes a widened id union', () => {
        const before = [d(3, `Type '"home"' does not satisfy the constraint '"village"'.`)];
        const after = [d(3, `Type '"home"' does not satisfy the constraint '"village" | "village_inn"'.`)];
        expect(newDiagnostics(before, after)).toEqual([]);
    });

    it('reports an error the change adds', () => {
        const fresh = d(5, 'b', 'data/chapters/start/start.chapter.ts');
        expect(newDiagnostics([d(3, 'a')], [d(3, 'a'), fresh])).toEqual([fresh]);
    });

    it('matches each old error once', () => {
        expect(newDiagnostics([d(3, 'a')], [d(3, 'a'), d(3, 'b')])).toEqual([d(3, 'b')]);
    });
});
