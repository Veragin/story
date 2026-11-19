/** A Claude Code session id. Checked before it reaches a launcher request or a transcript path. */
export const AI_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isAiSessionId = (value: unknown): value is string =>
    typeof value === 'string' && AI_SESSION_ID_PATTERN.test(value);

/** The longest `sendAiMessage` text, in characters (after trimming). */
export const AI_MESSAGE_MAX_LENGTH = 20_000;

/** The SSE event name of every `aiEvents` message; `data` is a `TAiEvent`. */
export const AI_SSE_EVENT = 'ai';

export type TAiStatus = 'unavailable' | 'disabled' | 'no_credits' | 'stopped' | 'starting' | 'ready' | 'busy' | 'error';

/** `at` is an ISO date. */
export type TAiMessageDto =
    | { kind: 'user'; id: string; text: string; at: string }
    | { kind: 'assistant'; id: string; text: string; at: string }
    /** Command output and errors. */
    | { kind: 'system'; id: string; text: string; at: string };

export type TAiTokensDto = {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
};

export type TAiEvent =
    | {
          type: 'snapshot';
          status: TAiStatus;
          credits: number;
          sessionId: string | null;
          messages: TAiMessageDto[];
          touchedFiles: string[];
      }
    | { type: 'status'; status: TAiStatus; message?: string }
    | { type: 'message'; message: TAiMessageDto }
    /** Story-relative paths edited in the running turn; `[]` when the turn ends. */
    | { type: 'activity'; touchedFiles: string[] }
    | { type: 'usage'; credits: number; turnCredits: number; tokens: TAiTokensDto };

/**
 * `available`: the server can run agents (launcher, image and token). `enabled`: the story's `aiFeature`.
 * `credits` may be negative: the last turn can overdraw.
 */
export type TAiDto = {
    available: boolean;
    enabled: boolean;
    credits: number;
    status: TAiStatus;
    sessionId: string | null;
};

/** `createdAt` and `lastUsedAt` are ISO dates. */
export type TAiSessionDto = {
    sessionId: string;
    title: string;
    createdAt: string;
    lastUsedAt: string;
};

/** Commands (`/clear`, `/resume`, …) are handled by the server. */
export type TAiSendMessageDto = { text: string };

export type TAiResumeDto = { sessionId: string };
