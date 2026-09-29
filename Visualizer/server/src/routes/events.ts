import type { TServerContext } from '../context';
import { openEventStream } from '../events/sse';
import { RAW_RESPONSE } from '../http/router';

/** `GET /events` — the story's SSE change feed (protocol `dto/events.ts`): only its own bus's events. */
export const registerEventRoutes = ({ router, bus }: TServerContext) => {
    router.handle('events', ({ res }) => {
        openEventStream(res, bus);
        return RAW_RESPONSE;
    });
};
