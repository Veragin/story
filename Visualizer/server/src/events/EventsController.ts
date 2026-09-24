import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable, map, merge, timer } from 'rxjs';
import { FileWatcherService, type TFileChangeEvent } from './FileWatcherService';

/**
 * `GET /api/events` — server-sent events for on-disk changes (VISUALIZER_PLAN §5.3).
 *
 * SSE rather than a WebSocket, deliberately: the traffic is one-way (the server tells the
 * client a file moved under it), SSE reconnects on its own with no client-side retry loop, and
 * it goes through the Vite proxy without an upgrade handshake to configure.
 *
 * The heartbeat is not decoration. An idle SSE connection through a proxy is indistinguishable
 * from a dead one, and both Vite's proxy and any reverse proxy in front of it will eventually
 * close a silent stream; a comment every 25 seconds keeps it open and lets the browser's own
 * reconnect logic notice a genuinely dead server.
 */
@Controller('events')
export class EventsController {
    constructor(private readonly watcher: FileWatcherService) {}

    @Sse()
    stream(): Observable<MessageEvent> {
        const changes = this.watcher.changes.pipe(
            map((event: TFileChangeEvent): MessageEvent => ({ type: 'changed', data: event }))
        );

        const heartbeat = timer(25_000, 25_000).pipe(
            map((): MessageEvent => ({ type: 'ping', data: { type: 'ping' } }))
        );

        return merge(changes, heartbeat);
    }
}
