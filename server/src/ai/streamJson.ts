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
    | { type: 'prompt'; message: TAiMessageDto }
    | { type: 'reply'; message: TAiMessageDto }
    | { type: 'tools'; editedFiles: string[] }
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

const idOf = (line: TRecord, message: TRecord, ctx: TStreamContext): string =>
    text(line.uuid) ?? text(message.id) ?? ctx.nextId();

// only the text after the last tool call is shown: earlier text narrates the agent's steps
const assistantItem = (line: TRecord, ctx: TStreamContext): TStreamItem | null => {
    const message = isPlainObject(line.message) ? line.message : null;
    if (!message) return null;
    const blocks = records(message.content);
    const tools = blocks.filter((block) => block.type === 'tool_use' && text(block.name) !== null);
    if (tools.length > 0) {
        const editedFiles = tools.flatMap((block) => {
            const file = filePathOf(isPlainObject(block.input) ? block.input : {}, ctx.storyRoot);
            return EDIT_TOOLS.includes(text(block.name) ?? '') && file !== null ? [file] : [];
        });
        return { type: 'tools', editedFiles };
    }
    const reply = blocks
        .filter((block) => block.type === 'text')
        .map((block) => text(block.text) ?? '')
        .filter((value) => value.trim())
        .join('\n\n');
    return reply
        ? { type: 'reply', message: { kind: 'assistant', id: idOf(line, message, ctx), text: reply, at: ctx.at } }
        : null;
};

const isInjected = (value: string) => /^(<(local-)?command-|Base directory for this skill:)/.test(value.trimStart());

// typed prompts are plain strings; block content carries tool results and loaded skills
const userItem = (line: TRecord, ctx: TStreamContext): TStreamItem | null => {
    const message = isPlainObject(line.message) ? line.message : null;
    if (!message || line.isMeta === true || text(line.sourceToolUseID) !== null) return null;
    const prompt = text(message.content);
    if (!prompt?.trim() || isInjected(prompt)) return null;
    return { type: 'prompt', message: { kind: 'user', id: idOf(line, message, ctx), text: prompt, at: ctx.at } };
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

// the reply a turn ends with so far: `null` once the agent calls a tool after it
export const pendingReply = (current: TAiMessageDto | null, item: TStreamItem): TAiMessageDto | null => {
    if (item.type === 'reply') return item.message;
    return item.type === 'tools' ? null : current;
};

// a Claude Code session transcript (`<sessionId>.jsonl`): prompts and the reply each turn ended with
export const transcriptMessages = (jsonl: string, storyRoot: string, nextId: () => string): TAiMessageDto[] => {
    const messages: TAiMessageDto[] = [];
    let reply: TAiMessageDto | null = null;
    const flush = () => {
        if (reply) messages.push(reply);
        reply = null;
    };
    for (const raw of jsonl.split('\n')) {
        const line = raw.trim() ? parseJson(raw) : null;
        if (!line) continue;
        const at = text(line.timestamp) ?? new Date(0).toISOString();
        const item = lineItem(line, { storyRoot, at, nextId });
        if (item?.type === 'prompt') {
            flush();
            messages.push(item.message);
        } else if (item) {
            reply = pendingReply(reply, item);
        }
    }
    flush();
    return messages;
};

export const userLine = (prompt: string): string =>
    JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } });

export const interruptLine = (requestId: string): string =>
    JSON.stringify({ type: 'control_request', request_id: requestId, request: { subtype: 'interrupt' } });
