import type { TServerContext } from '../context';
import { openEventStream } from '../events/sse';
import { RAW_RESPONSE } from '../http/router';

export const registerEventRoutes = ({ router, bus }: TServerContext) => {
    router.handle('events', ({ res }) => {
        openEventStream(res, bus);
        return RAW_RESPONSE;
    });
};
