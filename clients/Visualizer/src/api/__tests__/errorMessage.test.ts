import '@story/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../ApiError';
import { errorBodyMessage, errorMessage } from '../errorMessage';

describe('errorMessage', () => {
    it('uses the message of a plain Error', () => {
        expect(errorMessage(new Error('boom'))).toBe('boom');
    });

    it('stringifies non-errors', () => {
        expect(errorMessage('oops')).toBe('oops');
        expect(errorMessage(42)).toBe('42');
    });

    it('explains a 501', () => {
        expect(errorMessage(new ApiError(501, { error: 'internal' }))).toMatch(/does not implement/);
    });

    it('lists the diagnostics of an invalid error', () => {
        const e = new ApiError(422, {
            error: 'invalid',
            diagnostics: [
                { file: 'a.ts', line: 1, column: 2, message: 'First' },
                { file: 'b.ts', line: 3, column: 4, message: 'Second', code: 2322 },
            ],
        });
        expect(errorMessage(e)).toBe('a.ts:1:2 First\nb.ts:3:4 TS2322: Second');
    });

    it('falls back to the body for an invalid error without diagnostics', () => {
        expect(errorMessage(new ApiError(422, { error: 'invalid', message: 'Bad input' }))).toBe('invalid: Bad input');
    });

    it('formats other api errors from their body', () => {
        expect(errorMessage(new ApiError(409, { error: 'exists', message: 'Taken' }))).toBe('exists: Taken');
        expect(errorMessage(new ApiError(500, { error: 'internal' }))).toBe('internal (500)');
    });
});

describe('errorBodyMessage', () => {
    it('uses the friendly git text', () => {
        expect(errorBodyMessage({ error: 'git_dirty' })).toMatch(/uncommitted changes/);
    });

    it('adds the detail for git remote errors', () => {
        expect(errorBodyMessage({ error: 'git_remote', message: 'timeout' })).toMatch(/\(timeout\)$/);
    });

    it('omits the status when not given', () => {
        expect(errorBodyMessage({ error: 'internal' })).toBe('internal');
    });
});
