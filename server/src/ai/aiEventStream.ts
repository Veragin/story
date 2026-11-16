import type { ServerResponse } from 'node:http';
import { AI_SSE_EVENT, type TAiEvent } from '@story/protocol';
import type { TStoryGrant } from '../auth/storyGrant';
import { endAtExpiry } from '../events/endAtExpiry';
import { openSse } from '../events/sse';

export type TAiEventSink = (event: TAiEvent) => void;

// `connect` subscribes the sink and returns the unsubscribe, run when the stream closes
export const streamAiEvents = (
    res: ServerResponse,
    grant: TStoryGrant | undefined,
    connect: (sink: TAiEventSink) => () => void
): void => {
    let disconnect: (() => void) | null = null;
    let closed = false;
    const send = openSse(res, () => {
        closed = true;
        disconnect?.();
    });
    if (grant) endAtExpiry(res, grant.expiresAt);
    disconnect = connect((event) => send(AI_SSE_EVENT, event));
    if (closed) disconnect();
};
