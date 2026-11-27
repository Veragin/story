import type { ServerResponse } from 'node:http';
import { SSE_EVENT, type TChangeEvent, type THelloEvent, type TStoryEvent } from '@story/protocol';
import type { EventBus } from './EventBus';

// keeps proxies (Vite's included) from closing an idle stream
const HEARTBEAT_MS = 25_000;

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export type TSseSend = (event: string, data: unknown) => void;

export const openSse = (res: ServerResponse, onClose: () => void = () => undefined): TSseSend => {
    res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    let closed = false;
    const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        onClose();
    };
    res.on('close', cleanup);
    res.on('error', cleanup);
    return (event, data) => {
        if (!closed && !res.writableEnded) res.write(frame(event, data));
    };
};

export const openEventStream = (res: ServerResponse, bus: EventBus) => {
    let unsubscribe = () => {};
    let unsubscribeStory = () => {};
    const send = openSse(res, () => {
        unsubscribe();
        unsubscribeStory();
    });
    const hello: THelloEvent = { connectedAt: new Date().toISOString() };
    send(SSE_EVENT.hello, hello);
    unsubscribe = bus.subscribe((event: TChangeEvent) => send(SSE_EVENT.change, event));
    unsubscribeStory = bus.onStory((event: TStoryEvent) => send(SSE_EVENT.story, event));
};
