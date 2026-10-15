import type { ServerResponse } from 'node:http';
import { SSE_EVENT, type TChangeEvent, type THelloEvent } from '@story/visualizer-protocol';
import type { EventBus } from './EventBus';

// keeps proxies (Vite's included) from closing an idle stream
const HEARTBEAT_MS = 25_000;

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const openEventStream = (res: ServerResponse, bus: EventBus) => {
    res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    const hello: THelloEvent = { connectedAt: new Date().toISOString() };
    res.write(frame(SSE_EVENT.hello, hello));

    const unsubscribe = bus.subscribe((event: TChangeEvent) => {
        res.write(frame(SSE_EVENT.change, event));
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
    };
    res.on('close', cleanup);
    res.on('error', cleanup);
};
