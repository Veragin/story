import { describe, expect, it } from 'vitest';
import { BODYLESS_ROUTES, ERROR_STATUS, isAiSessionId, STORY_ROUTES } from '../src';

describe('AI protocol', () => {
    it('accepts lower-case UUIDs as session ids, nothing else', () => {
        expect(isAiSessionId('0b6f3a52-6d1e-4f7c-9a43-2d8e5c1f7a90')).toBe(true);
        for (const value of [
            '0B6F3A52-6D1E-4F7C-9A43-2D8E5C1F7A90',
            '0b6f3a52-6d1e-4f7c-9a43-2d8e5c1f7a9',
            '../0b6f3a52-6d1e-4f7c-9a43-2d8e5c1f7a90',
            '0b6f3a52-6d1e-4f7c-9a43-2d8e5c1f7a90\n',
            '',
            42,
            null,
        ]) {
            expect(isAiSessionId(value)).toBe(false);
        }
    });

    it('maps the AI error codes to their statuses', () => {
        expect(ERROR_STATUS.ai_no_credits).toBe(402);
        expect(ERROR_STATUS.ai_busy).toBe(409);
        expect(ERROR_STATUS.ai_disabled).toBe(403);
        expect(ERROR_STATUS.ai_unavailable).toBe(503);
    });

    it('declares the AI routes for editors only; interrupt and clear take no body', () => {
        const aiRoutes = Object.entries(STORY_ROUTES).filter(([, def]) => def.path.startsWith('/ai'));
        expect(aiRoutes.map(([name]) => name).sort()).toEqual(
            ['aiEvents', 'clearAi', 'getAi', 'interruptAi', 'listAiSessions', 'resumeAi', 'sendAiMessage'].sort()
        );
        for (const [, def] of aiRoutes) expect(def.access).toBe('write');
        expect(BODYLESS_ROUTES).toEqual(expect.arrayContaining(['interruptAi', 'clearAi']));
    });
});
