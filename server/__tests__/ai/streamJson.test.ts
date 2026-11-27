import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TAiMessageDto } from '@story/protocol';
import {
    interruptLine,
    parseStreamLine,
    pendingReply,
    storyRelative,
    transcriptMessages,
    userLine,
    type TStreamContext,
    type TStreamItem,
} from '../../src/ai/streamJson';

// Hand-written from the documented Claude Code stream-json / transcript shapes, not captured from a live run:
// replace them with real output once the spike (plan phase 1) has recorded some.
const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures', 'ai');

const AT = '2026-11-16T12:00:00.000Z';

const context = (): TStreamContext => {
    let n = 0;
    return { storyRoot: '/repo/stories/story', at: AT, nextId: () => `id-${++n}` };
};

const parseFixture = async (name: string): Promise<(TStreamItem | null)[]> => {
    const ctx = context();
    const text = await readFile(path.join(FIXTURES, name), 'utf8');
    return text
        .split('\n')
        .filter(Boolean)
        .map((line) => parseStreamLine(line, ctx));
};

describe('stream-json mapping', () => {
    it('maps a turn to edited files and replies, hiding tool calls and their results', async () => {
        const items = await parseFixture('editTurn.stdout.jsonl');
        expect(items[0]).toEqual({
            type: 'init',
            sessionId: 'f3b1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
            model: 'claude-sonnet-5-5',
        });
        expect(items[1]).toEqual({
            type: 'reply',
            message: {
                kind: 'assistant',
                id: '5a1c9a8e-2d3f-4b77-8a0e-6c3d2e1f0a11',
                text: "I'll look at the village chapter first.",
                at: AT,
            },
        });
        expect(items[2]).toEqual({ type: 'tools', editedFiles: [] });
        expect(items[3]).toBeNull();
        expect(items[4]).toEqual({ type: 'tools', editedFiles: ['data/chapters/village/village.chapter.ts'] });
        expect(items[5]).toBeNull();
        expect(items[6]).toEqual({
            type: 'tools',
            editedFiles: ['data/chapters/village/village.passages/well.ts', 'data/chapters/village/village.chapter.ts'],
        });
        expect(items[7]).toBeNull();
        expect(items[8]).toMatchObject({
            type: 'reply',
            message: { kind: 'assistant', text: expect.stringContaining('well') },
        });
        expect(items[9]).toEqual({
            type: 'result',
            result: {
                sessionId: 'f3b1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
                subtype: 'success',
                isError: false,
                costUsd: 0.0734512,
                usage: { inputTokens: 12, outputTokens: 299, cacheReadTokens: 52048, cacheCreationTokens: 2560 },
                model: 'claude-sonnet-5-5',
            },
            messages: [],
        });
    });

    it('keeps only the reply a turn ends with', async () => {
        const items = (await parseFixture('editTurn.stdout.jsonl')).filter((item) => item !== null);
        const reply = items.reduce<TAiMessageDto | null>((current, item) => pendingReply(current, item), null);
        expect(reply?.text).toBe('Renamed the village to "Old village" and added a well passage.');
    });

    it('hides loaded skills, command echoes and meta prompts', () => {
        const ctx = context();
        const user = (line: Record<string, unknown>) =>
            parseStreamLine(JSON.stringify({ type: 'user', uuid: 'u', ...line }), ctx);
        expect(
            user({ message: { content: 'Base directory for this skill: /skills/passages\n# Passages' } })
        ).toBeNull();
        expect(
            user({ message: { content: [{ type: 'text', text: '# Passages skill' }] }, sourceToolUseID: 'toolu_1' })
        ).toBeNull();
        expect(user({ message: { content: '<command-name>/passages</command-name>' } })).toBeNull();
        expect(user({ message: { content: 'Caveat' }, isMeta: true })).toBeNull();
        expect(user({ message: { content: 'Add a well' } })).toEqual({
            type: 'prompt',
            message: { kind: 'user', id: 'u', text: 'Add a well', at: AT },
        });
    });

    it('maps a budget stop to an error result with a system message; ignores noise', async () => {
        const items = await parseFixture('budgetStop.stdout.jsonl');
        expect(items[0]).toEqual({ type: 'control_response', requestId: 'interrupt-1', ok: true });
        expect(items[1]).toBeNull();
        expect(items[2]).toMatchObject({
            type: 'result',
            result: { subtype: 'error_max_budget_usd', isError: true, costUsd: 0.51, model: null },
            messages: [{ kind: 'system', text: 'The agent stopped: the spending cap of this run was reached' }],
        });
        expect(items.slice(3)).toEqual([null, null]);
    });

    it('collects edited files and keeps paths outside the story absolute', () => {
        const ctx = context();
        const tool = (name: string, input: Record<string, unknown>) =>
            parseStreamLine(
                JSON.stringify({
                    type: 'assistant',
                    message: { id: 'm', content: [{ type: 'tool_use', id: `t-${name}`, name, input }] },
                }),
                ctx
            );
        expect(tool('Skill', { skill: 'passages' })).toEqual({ type: 'tools', editedFiles: [] });
        expect(tool('Read', { file_path: '/repo/stories/story/data/a.ts' })).toEqual({
            type: 'tools',
            editedFiles: [],
        });
        expect(tool('Edit', { file_path: '../other/data/x.ts' })).toEqual({
            type: 'tools',
            editedFiles: ['/repo/stories/other/data/x.ts'],
        });
    });

    it('relativises paths against the story root', () => {
        expect(storyRelative('/repo/stories/story', '/repo/stories/story/data/a.ts')).toBe('data/a.ts');
        expect(storyRelative('/repo/stories/story', 'types/T.ts')).toBe('types/T.ts');
        expect(storyRelative('/repo/stories/story', '/tmp/x')).toBe('/tmp/x');
    });

    it('replays a transcript: prompts and final replies; no tools, meta, sidechain or summary lines', async () => {
        const jsonl = await readFile(path.join(FIXTURES, 'session.transcript.jsonl'), 'utf8');
        let n = 0;
        const messages = transcriptMessages(jsonl, '/repo/stories/story', () => `id-${++n}`);
        expect(messages).toEqual([
            {
                kind: 'user',
                id: '11111111-2222-4333-8444-555555555555',
                text: 'Rename the village to Old village',
                at: '2026-11-16T10:00:00.000Z',
            },
            {
                kind: 'assistant',
                id: '66666666-2222-4333-8444-555555555555',
                text: 'Done: the village is now "Old village".',
                at: '2026-11-16T10:00:09.000Z',
            },
        ]);
    });

    it('writes user and interrupt lines in the stream-json input format', () => {
        expect(JSON.parse(userLine('hi'))).toEqual({ type: 'user', message: { role: 'user', content: 'hi' } });
        expect(JSON.parse(interruptLine('r1'))).toEqual({
            type: 'control_request',
            request_id: 'r1',
            request: { subtype: 'interrupt' },
        });
    });
});
