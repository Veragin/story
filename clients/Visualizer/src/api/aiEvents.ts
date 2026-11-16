import { AI_SSE_EVENT, type TAiEvent } from '@story/protocol';
import {
    defaultCreateEventSource,
    eventData,
    ReconnectingEventSource,
    type TCreateEventSource,
} from './ReconnectingEventSource';

export type TAiEventListener = (event: TAiEvent) => void;

export type TAiEventsConnection = {
    reconnectNow(): void;
    close(): void;
};

export type TAiEventsOptions = {
    url: string;
    onEvent: TAiEventListener;
    createEventSource?: TCreateEventSource | null;
    reconnectMinMs?: number;
    reconnectMaxMs?: number;
    onGiveUp?: () => void;
};

const AI_EVENT_TYPES: readonly string[] = [
    'snapshot',
    'status',
    'message',
    'activity',
    'usage',
] satisfies readonly TAiEvent['type'][];

export const isAiEvent = (value: unknown): value is TAiEvent =>
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    AI_EVENT_TYPES.includes(value.type);

const NO_CONNECTION: TAiEventsConnection = { reconnectNow: () => {}, close: () => {} };

export const openAiEvents = ({
    url,
    onEvent,
    createEventSource = defaultCreateEventSource(),
    reconnectMinMs = 1000,
    reconnectMaxMs = 15_000,
    onGiveUp,
}: TAiEventsOptions): TAiEventsConnection => {
    if (!createEventSource) return NO_CONNECTION;
    const stream: ReconnectingEventSource = new ReconnectingEventSource({
        url,
        createEventSource,
        reconnectMinMs,
        reconnectMaxMs,
        onGiveUp,
        onConnecting: () => {},
        onReconnecting: () => {},
        listen: (source) =>
            source.addEventListener(AI_SSE_EVENT, (e) => {
                stream.resetBackoff();
                const data = eventData(e);
                if (isAiEvent(data)) onEvent(data);
                else console.error('[api/aiEvents] bad event', data);
            }),
    });
    stream.connect();
    return { reconnectNow: () => stream.reconnectNow(), close: () => stream.close() };
};
