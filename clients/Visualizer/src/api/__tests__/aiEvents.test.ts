import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TAiEvent } from '@story/protocol';
import { openAiEvents } from '../aiEvents';
import { createHttpApi } from '../httpApi';

type TStub = EventTarget & { readyState: number; onerror: (() => void) | null; close: () => void; url: string };

const stubs: TStub[] = [];

const createEventSource = (url: string) => {
    const stub: TStub = Object.assign(new EventTarget(), { readyState: 0, onerror: null, close: vi.fn(), url });
    stubs.push(stub);
    // the DOM listener types are invariant in the event type; the other stream tests stub it the same way
    return stub as never;
};

const send = (stub: TStub, data: unknown) =>
    stub.dispatchEvent(new MessageEvent('ai', { data: typeof data === 'string' ? data : JSON.stringify(data) }));

describe('openAiEvents', () => {
    afterEach(() => {
        stubs.length = 0;
        vi.useRealTimers();
    });

    it('delivers valid events, drops malformed ones and reconnects after the browser gives up', () => {
        vi.useFakeTimers();
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const seen: TAiEvent[] = [];
        const onGiveUp = vi.fn();
        const connection = openAiEvents({
            url: '/ai/events',
            onEvent: (e) => seen.push(e),
            createEventSource,
            reconnectMinMs: 100,
            onGiveUp,
        });
        send(stubs[0], { type: 'status', status: 'ready' });
        send(stubs[0], { type: 'nope' });
        send(stubs[0], 'not json');
        expect(seen).toEqual([{ type: 'status', status: 'ready' }]);
        expect(error).toHaveBeenCalledTimes(2);

        stubs[0].readyState = 2;
        stubs[0].onerror?.();
        expect(onGiveUp).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(100);
        expect(stubs).toHaveLength(2);

        connection.close();
        expect(stubs[1].close).toHaveBeenCalled();
        error.mockRestore();
    });

    it('opens the story-scoped stream over http', () => {
        const api = createHttpApi({ storyId: 'example', createEventSource });
        const connection = api.aiEvents(() => {});
        expect(stubs[0].url).toBe('/api/stories/example/ai/events');
        connection.close();
    });

    it('opens nothing without EventSource', () => {
        const connection = openAiEvents({ url: '/x', onEvent: () => {}, createEventSource: null });
        expect(stubs).toHaveLength(0);
        connection.close();
    });
});
