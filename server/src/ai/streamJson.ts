import path from 'node:path';
import type { TAiMessageDto } from '@story/protocol';
import { isPlainObject } from '../common/isPlainObject';

export type TStreamUsage = {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
};

export type TStreamResult = {
    sessionId: string | null;
    subtype: string;
    isError: boolean;
    costUsd: number;
    usage: TStreamUsage;
    model: string | null;
};

export type TStreamItem =
    | { type: 'init'; sessionId: string; model: string | null }
    | { type: 'messages'; messages: TAiMessageDto[]; editedFiles: string[] }
    | { type: 'result'; result: TStreamResult; messages: TAiMessageDto[] }
    | { type: 'control_response'; requestId: string; ok: boolean };

// `storyRoot`: the story folder as the agent sees it, so tool paths become story-relative
export type TStreamContext = { storyRoot: string; at: string; nextId: () => string };

type TRecord = Record<string, unknown>;

const EDIT_TOOLS = ['Edit', 'MultiEdit', 'Write', 'NotebookEdit'];

const RESULT_ERRORS: Record<string, string> = {
    error_max_budget_usd: 'The agent stopped: the spending cap of this run was reached',
    error_max_turns: 'The agent stopped: the turn took too many steps',
    error_during_execution: 'The agent stopped because of an error',
};

const MAX_ERROR_TEXT = 300;

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const count = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

const records = (value: unknown): TRecord[] => (Array.isArray(value) ? value.filter(isPlainObject) : []);

const parseJson = (line: string): TRecord | null => {
    try {
        const value: unknown = JSON.parse(line);
        return isPlainObject(value) ? value : null;
    } catch {
        return null;
    }
};

const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

export const storyRelative = (storyRoot: string, file: string): string => {
    const absolute = path.posix.resolve(storyRoot, file);
    const relative = path.posix.relative(storyRoot, absolute);
    return relative.startsWith('..') ? absolute : relative;
};

const filePathOf = (input: TRecord, storyRoot: string): string | null => {
    const file = text(input.file_path) ?? text(input.notebook_path) ?? text(input.path);
    return file === null ? null : storyRelative(storyRoot, file);
};

const toolSummary = (tool: string, input: TRecord, storyRoot: string): string => {
    const file = filePathOf(input, storyRoot);
    const pattern = text(input.pattern);
    switch (tool) {
        case 'Edit':
        case 'MultiEdit':
        case 'NotebookEdit':
            return file ? `Edited ${file}` : 'Edited a file';
        case 'Write':
            return file ? `Wrote ${file}` : 'Wrote a file';
        case 'Read':
            return file ? `Read ${file}` : 'Read a file';
        case 'Glob':
            return pattern ? `Listed files ${pattern}` : 'Listed files';
        case 'Grep':
            return pattern ? `Searched for "${pattern}"${file ? ` in ${file}` : ''}` : 'Searched the files';
        case 'Skill': {
            const skill = text(input.skill) ?? text(input.command);
            return skill ? `Used the ${skill} skill` : 'Used a skill';
        }
        case 'TodoWrite':
            return 'Updated its to-do list';
        default:
            return `Used ${tool}`;
    }
};

const idOf = (line: TRecord, message: TRecord, ctx: TStreamContext): string =>
    text(line.uuid) ?? text(message.id) ?? ctx.nextId();

const assistantItem = (line: TRecord, ctx: TStreamContext): TStreamItem | null => {
    const message = isPlainObject(line.message) ? line.message : null;
    if (!message) return null;
    const base = idOf(line, message, ctx);
    const messages: TAiMessageDto[] = [];
    const editedFiles: string[] = [];
    records(message.content).forEach((block, index) => {
        const blockText = text(block.text);
        if (block.type === 'text' && blockText?.trim()) {
            messages.push({ kind: 'assistant', id: `${base}:${index}`, text: blockText, at: ctx.at });
        }
        const tool = text(block.name);
        if (block.type !== 'tool_use' || tool === null) return;
        const input = isPlainObject(block.input) ? block.input : {};
        const id = text(block.id) ?? `${base}:${index}`;
        messages.push({ kind: 'tool', id, tool, summary: toolSummary(tool, input, ctx.storyRoot), at: ctx.at });
        const file = filePathOf(input, ctx.storyRoot);
        if (EDIT_TOOLS.includes(tool) && file !== null) editedFiles.push(file);
    });
    return messages.length > 0 ? { type: 'messages', messages, editedFiles } : null;
};

const toolResultText = (content: unknown): string => {
    const value =
        typeof content === 'string'
            ? content
            : records(content)
                  .map((block) => text(block.text) ?? '')
                  .join('\n');
    return truncate(value.trim().split('\n')[0] ?? '', MAX_ERROR_TEXT);
};

const isCommandEcho = (value: string) => /^<(local-)?command-/.test(value.trimStart());

// prompts appear only in transcripts (stdout does not echo them); tool results only matter when they failed
const userItem = (line: TRecord, ctx: TStreamContext): TStreamItem | null => {
    const message = isPlainObject(line.message) ? line.message : null;
    if (!message || line.isMeta === true) return null;
    const base = idOf(line, message, ctx);
    const content = message.content;
    if (typeof content === 'string') {
        if (!content.trim() || isCommandEcho(content)) return null;
        return { type: 'messages', messages: [{ kind: 'user', id: base, text: content, at: ctx.at }], editedFiles: [] };
    }
    const blocks = records(content);
    const prompt = blocks
        .filter((block) => block.type === 'text')
        .map((block) => text(block.text) ?? '')
        .join('\n');
    const failures: TAiMessageDto[] = blocks
        .filter((block) => block.type === 'tool_result' && block.is_error === true)
        .map((block, index) => ({
            kind: 'system',
            id: `${text(block.tool_use_id) ?? base}:error:${index}`,
            text: `A tool call failed: ${toolResultText(block.content)}`,
            at: ctx.at,
        }));
    const messages: TAiMessageDto[] =
        prompt.trim() && !isCommandEcho(prompt) ? [{ kind: 'user', id: base, text: prompt, at: ctx.at }] : [];
    messages.push(...failures);
    return messages.length > 0 ? { type: 'messages', messages, editedFiles: [] } : null;
};

const usageOf = (usage: unknown): TStreamUsage => {
    const value = isPlainObject(usage) ? usage : {};
    return {
        inputTokens: count(value.input_tokens),
        outputTokens: count(value.output_tokens),
        cacheReadTokens: count(value.cache_read_input_tokens),
        cacheCreationTokens: count(value.cache_creation_input_tokens),
    };
};

const resultItem = (line: TRecord, ctx: TStreamContext): TStreamItem => {
    const subtype = text(line.subtype) ?? 'success';
    const isError = line.is_error === true || subtype !== 'success';
    const models = isPlainObject(line.modelUsage) ? Object.keys(line.modelUsage) : [];
    const cost = line.total_cost_usd;
    const result: TStreamResult = {
        sessionId: text(line.session_id),
        subtype,
        isError,
        costUsd: typeof cost === 'number' && Number.isFinite(cost) && cost > 0 ? cost : 0,
        usage: usageOf(line.usage),
        model: models[0] ?? null,
    };
    const detail = text(line.result);
    const errorText = RESULT_ERRORS[subtype] ?? (detail ? truncate(detail, MAX_ERROR_TEXT) : 'The agent stopped');
    const messages: TAiMessageDto[] = isError
        ? [{ kind: 'system', id: `${text(line.uuid) ?? ctx.nextId()}:result`, text: errorText, at: ctx.at }]
        : [];
    return { type: 'result', result, messages };
};

const controlItem = (line: TRecord): TStreamItem | null => {
    const response = isPlainObject(line.response) ? line.response : null;
    const requestId = response ? text(response.request_id) : null;
    if (!response || requestId === null) return null;
    return { type: 'control_response', requestId, ok: response.subtype === 'success' };
};

const lineItem = (line: TRecord, ctx: TStreamContext): TStreamItem | null => {
    if (line.isSidechain === true) return null;
    switch (line.type) {
        case 'system': {
            const sessionId = text(line.session_id);
            return line.subtype === 'init' && sessionId ? { type: 'init', sessionId, model: text(line.model) } : null;
        }
        case 'assistant':
            return assistantItem(line, ctx);
        case 'user':
            return userItem(line, ctx);
        case 'result':
            return resultItem(line, ctx);
        case 'control_response':
            return controlItem(line);
        default:
            return null;
    }
};

export const parseStreamLine = (line: string, ctx: TStreamContext): TStreamItem | null => {
    const parsed = parseJson(line);
    return parsed ? lineItem(parsed, ctx) : null;
};

// a Claude Code session transcript (`<sessionId>.jsonl`), mapped like the live stream
export const transcriptMessages = (jsonl: string, storyRoot: string, nextId: () => string): TAiMessageDto[] =>
    jsonl.split('\n').flatMap((raw) => {
        const line = raw.trim() ? parseJson(raw) : null;
        if (!line) return [];
        const at = text(line.timestamp) ?? new Date(0).toISOString();
        const item = lineItem(line, { storyRoot, at, nextId });
        return item?.type === 'messages' ? item.messages : [];
    });

export const userLine = (prompt: string): string =>
    JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } });

export const interruptLine = (requestId: string): string =>
    JSON.stringify({ type: 'control_request', request_id: requestId, request: { subtype: 'interrupt' } });
