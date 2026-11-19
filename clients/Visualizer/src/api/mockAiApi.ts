import { isAiSessionId, type TAiEvent, type TAiMessageDto, type TAiSessionDto, type TAiStatus } from '@story/protocol';
import { commandHelp } from '../ai/aiCommands';
import type { TAiEventListener } from './aiEvents';
import { clone, fail, notFound } from './mockHelpers';
import type { TVisualizerApi } from './types';

type TMockAiContext = {
    available: boolean;
    enabled: () => boolean;
    credits: number;
    stepMs: number;
    reply: <T>(fn: () => T) => Promise<T>;
};

type TAiRoutes = 'getAi' | 'aiEvents' | 'sendAiMessage' | 'interruptAi' | 'listAiSessions' | 'resumeAi' | 'clearAi';

type TMockSession = TAiSessionDto & { messages: TAiMessageDto[] };

const MAX_SESSIONS = 10;
const TITLE_MAX_LENGTH = 120;
const TURN_CREDITS = 1;
const FAKE_EDIT_FILE = 'data/chapters/start/start.passages.ts';
const EDIT_REQUEST = /\b(edit|change|write|add)\b/i;
const RESUME_COMMAND = /^\/resume(?:\s+(\d+))?$/;

const sessionIdOf = (n: number) => {
    const hex = n.toString(16).padStart(8, '0');
    return `${hex}-0000-4000-8000-${hex.padStart(12, '0')}`;
};

export const createMockAiApi = (ctx: TMockAiContext) => {
    let credits = ctx.credits;
    let status: TAiStatus = 'stopped';
    let sessionId: string | null = null;
    let messages: TAiMessageDto[] = [];
    let touchedFiles: string[] = [];
    let sessions: TMockSession[] = [];
    let counter = 0;
    let sessionCounter = 0;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const listeners = new Set<TAiEventListener>();

    const currentStatus = (): TAiStatus => {
        if (!ctx.available) return 'unavailable';
        if (!ctx.enabled()) return 'disabled';
        if (credits <= 0 && status !== 'busy') return 'no_credits';
        return status;
    };

    const deliver = (listener: TAiEventListener, event: TAiEvent) =>
        setTimeout(() => {
            if (listeners.has(listener)) listener(clone(event));
        }, 0);

    const emit = (event: TAiEvent) => listeners.forEach((listener) => deliver(listener, event));

    const snapshot = (): TAiEvent => ({
        type: 'snapshot',
        status: currentStatus(),
        credits,
        sessionId,
        messages,
        touchedFiles,
    });

    const setStatus = (next: TAiStatus, message?: string) => {
        status = next;
        emit({ type: 'status', status: currentStatus(), ...(message === undefined ? {} : { message }) });
    };

    const later = (steps: number, fn: () => void) => {
        timers.push(setTimeout(fn, ctx.stepMs * steps));
    };

    const cancelTurn = () => {
        timers.forEach(clearTimeout);
        timers = [];
        if (touchedFiles.length > 0) {
            touchedFiles = [];
            emit({ type: 'activity', touchedFiles });
        }
    };

    const addMessage = (message: TAiMessageDto) => {
        messages.push(message);
        emit({ type: 'message', message });
    };

    const nextId = () => `mock-ai-${++counter}`;
    const now = () => new Date().toISOString();

    const userMessage = (text: string) => addMessage({ kind: 'user', id: nextId(), text, at: now() });
    const systemMessage = (text: string) => addMessage({ kind: 'system', id: nextId(), text, at: now() });

    const recentSessions = () => [...sessions].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));

    const ensureSession = (title: string) => {
        if (sessionId !== null) return;
        const at = now();
        const session: TMockSession = {
            sessionId: sessionIdOf(++sessionCounter),
            title: title.slice(0, TITLE_MAX_LENGTH),
            createdAt: at,
            lastUsedAt: at,
            messages,
        };
        sessionId = session.sessionId;
        sessions = recentSessions().slice(0, MAX_SESSIONS - 1);
        sessions.push(session);
    };

    const touchSession = () => {
        const session = sessions.find((s) => s.sessionId === sessionId);
        if (session) session.lastUsedAt = now();
    };

    const restart = (session: TMockSession | null) => {
        cancelTurn();
        sessionId = session?.sessionId ?? null;
        messages = session?.messages ?? [];
        if (listeners.size > 0) status = 'ready';
        emit(snapshot());
    };

    const runTurn = (text: string) => {
        setStatus('busy');
        let step = 0;
        if (EDIT_REQUEST.test(text)) {
            later(++step, () => {
                touchedFiles = [FAKE_EDIT_FILE];
                emit({ type: 'activity', touchedFiles });
            });
        }
        later(++step, () => addMessage({ kind: 'assistant', id: nextId(), text: `You said:\n${text}`, at: now() }));
        later(++step, () => {
            timers = [];
            credits -= TURN_CREDITS;
            touchSession();
            emit({
                type: 'usage',
                credits,
                turnCredits: TURN_CREDITS,
                tokens: { input: text.length * 4, output: text.length * 2, cacheRead: 0, cacheCreation: 0 },
            });
            touchedFiles = [];
            emit({ type: 'activity', touchedFiles });
            setStatus('ready');
        });
    };

    const resumeCommand = (n: string | undefined) => {
        const recent = recentSessions();
        if (n === undefined) {
            systemMessage(
                recent.length === 0
                    ? 'No sessions yet'
                    : recent.map((s, i) => `${i + 1}. ${s.title} · ${s.lastUsedAt.slice(0, 10)}`).join('\n')
            );
            return;
        }
        const session = recent[Number(n) - 1];
        if (session) restart(session);
        else systemMessage(`No session ${n}`);
    };

    const runCommand = (text: string): boolean => {
        if (text === '/clear') {
            restart(null);
            return true;
        }
        const resume = RESUME_COMMAND.exec(text);
        if (resume) {
            userMessage(text);
            resumeCommand(resume[1]);
            return true;
        }
        if (text === '/cost') {
            userMessage(text);
            systemMessage(`Credits left: ${credits}`);
            return true;
        }
        if (text === '/help') {
            userMessage(text);
            systemMessage(commandHelp());
            return true;
        }
        return false;
    };

    const requireAgent = () => {
        if (!ctx.available) fail(503, { error: 'ai_unavailable' });
        if (!ctx.enabled()) fail(403, { error: 'ai_disabled' });
    };

    const routes: Pick<TVisualizerApi, TAiRoutes> = {
        getAi: () =>
            ctx.reply(() => ({
                available: ctx.available,
                enabled: ctx.enabled(),
                credits,
                status: currentStatus(),
                sessionId,
            })),

        aiEvents: (onEvent) => {
            listeners.add(onEvent);
            const startable = ctx.available && ctx.enabled() && credits > 0;
            if (status === 'stopped' && startable) {
                status = 'starting';
                later(1, () => setStatus('ready'));
            }
            deliver(onEvent, snapshot());
            return {
                reconnectNow: () => {},
                close: () => {
                    if (!listeners.delete(onEvent) || listeners.size > 0) return;
                    cancelTurn();
                    status = 'stopped';
                },
            };
        },

        sendAiMessage: ({ text }) =>
            ctx.reply(() => {
                requireAgent();
                const trimmed = text.trim();
                if (trimmed === '') fail(400, { error: 'bad_request', message: 'The message is empty' });
                if (status === 'busy' || status === 'starting') fail(409, { error: 'ai_busy' });
                if (credits <= 0) fail(402, { error: 'ai_no_credits' });
                if (!runCommand(trimmed)) {
                    ensureSession(trimmed);
                    userMessage(trimmed);
                    runTurn(trimmed);
                }
                return { ok: true as const };
            }),

        interruptAi: () =>
            ctx.reply(() => {
                requireAgent();
                if (status === 'busy') {
                    cancelTurn();
                    systemMessage('Interrupted');
                    setStatus('ready');
                }
                return { ok: true as const };
            }),

        listAiSessions: () =>
            ctx.reply(() => {
                requireAgent();
                return recentSessions().map((s) => ({
                    sessionId: s.sessionId,
                    title: s.title,
                    createdAt: s.createdAt,
                    lastUsedAt: s.lastUsedAt,
                }));
            }),

        resumeAi: ({ sessionId: id }) =>
            ctx.reply(() => {
                requireAgent();
                if (status === 'busy') fail(409, { error: 'ai_busy' });
                if (!isAiSessionId(id)) fail(400, { error: 'bad_request', message: 'Not a session id' });
                restart(sessions.find((s) => s.sessionId === id) ?? notFound(`session "${id}"`));
                return { ok: true as const };
            }),

        clearAi: () =>
            ctx.reply(() => {
                requireAgent();
                if (status === 'busy') fail(409, { error: 'ai_busy' });
                restart(null);
                return { ok: true as const };
            }),
    };

    const reset = () => {
        timers.forEach(clearTimeout);
        timers = [];
        credits = ctx.credits;
        status = 'stopped';
        sessionId = null;
        messages = [];
        touchedFiles = [];
        sessions = [];
        listeners.clear();
    };

    return { routes, reset };
};
