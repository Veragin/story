import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    interruptLine,
    parseStreamLine,
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
    it('maps a turn that reads, edits and writes files', async () => {
        const items = await parseFixture('editTurn.stdout.jsonl');
        expect(items[0]).toEqual({
            type: 'init',
            sessionId: 'f3b1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
            model: 'claude-sonnet-5-5',
        });
        expect(items[1]).toEqual({
            type: 'messages',
            messages: [
                {
                    kind: 'assistant',
                    id: '5a1c9a8e-2d3f-4b77-8a0e-6c3d2e1f0a11:0',
                    text: "I'll look at the village chapter first.",
                    at: AT,
                },
            ],
            editedFiles: [],
        });
        expect(items[2]).toEqual({
            type: 'messages',
            messages: [
                {
                    kind: 'tool',
                    id: 'toolu_01Read',
                    tool: 'Read',
                    summary: 'Read data/chapters/village/village.chapter.ts',
                    at: AT,
                },
            ],
            editedFiles: [],
        });
        expect(items[3]).toBeNull();
        expect(items[4]).toMatchObject({
            messages: [{ kind: 'tool', tool: 'Edit', summary: 'Edited data/chapters/village/village.chapter.ts' }],
            editedFiles: ['data/chapters/village/village.chapter.ts'],
        });
        expect(items[5]).toBeNull();
        expect(items[6]).toMatchObject({
            messages: [
                { kind: 'tool', tool: 'Write', summary: 'Wrote data/chapters/village/village.passages/well.ts' },
                { kind: 'tool', tool: 'Edit', id: 'toolu_01Edit2' },
            ],
            editedFiles: ['data/chapters/village/village.passages/well.ts', 'data/chapters/village/village.chapter.ts'],
        });
        expect(items[7]).toEqual({
            type: 'messages',
            messages: [
                {
                    kind: 'system',
                    id: 'toolu_01Edit2:error:0',
                    text: expect.stringMatching(/^A tool call failed: <tool_use_error>File has been modified/),
                    at: AT,
                },
            ],
            editedFiles: [],
        });
        expect(items[8]).toMatchObject({ messages: [{ kind: 'assistant', text: expect.stringContaining('well') }] });
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

    it('summarises the other tools and keeps paths outside the story absolute', () => {
        const ctx = context();
        const tool = (name: string, input: Record<string, unknown>) =>
            parseStreamLine(
                JSON.stringify({
                    type: 'assistant',
                    message: { id: 'm', content: [{ type: 'tool_use', id: `t-${name}`, name, input }] },
                }),
                ctx
            );
        const summary = (item: TStreamItem | null) =>
            item?.type === 'messages' && item.messages[0].kind === 'tool' ? item.messages[0].summary : null;
        expect(summary(tool('Glob', { pattern: 'data/**/*.ts' }))).toBe('Listed files data/**/*.ts');
        expect(summary(tool('Grep', { pattern: 'well', path: '/repo/stories/story/data' }))).toBe(
            'Searched for "well" in data'
        );
        expect(summary(tool('Read', { file_path: '/repo/clients/shared/core/src/index.ts' }))).toBe(
            'Read /repo/clients/shared/core/src/index.ts'
        );
        expect(summary(tool('Skill', { skill: 'passages' }))).toBe('Used the passages skill');
        expect(summary(tool('Mystery', {}))).toBe('Used Mystery');
        expect(tool('Edit', { file_path: '../other/data/x.ts' })).toMatchObject({
            editedFiles: ['/repo/stories/other/data/x.ts'],
        });
    });

    it('relativises paths against the story root', () => {
        expect(storyRelative('/repo/stories/story', '/repo/stories/story/data/a.ts')).toBe('data/a.ts');
        expect(storyRelative('/repo/stories/story', 'types/T.ts')).toBe('types/T.ts');
        expect(storyRelative('/repo/stories/story', '/tmp/x')).toBe('/tmp/x');
    });

    it('replays a transcript: prompts, tool calls and replies; no meta, sidechain or summary lines', async () => {
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
                kind: 'tool',
                id: 'toolu_01Edit',
                tool: 'Edit',
                summary: 'Edited data/chapters/village/village.chapter.ts',
                at: '2026-11-16T10:00:05.000Z',
            },
            {
                kind: 'assistant',
                id: '66666666-2222-4333-8444-555555555555:1',
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
