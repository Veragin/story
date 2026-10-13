import { once } from 'node:events';
import { Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { storyGrantOf } from '../auth/storyGrant';
import { ProtocolRoute } from '../common/ProtocolRoute';
import type { TServerContext } from '../storyContext/serverContext';
import { StoryCtx } from '../storyContext/StoryCtx';
import { endAtExpiry } from './endAtExpiry';
import { openEventStream } from './sse';

@Controller()
export class EventsController {
    @ProtocolRoute('events')
    async events(@StoryCtx() { bus }: TServerContext, @Req() req: Request, @Res() res: Response): Promise<void> {
        openEventStream(res, bus);
        const grant = storyGrantOf(req);
        if (grant) endAtExpiry(res, grant.expiresAt);
        // settling only when the stream closes holds the story lease for as long as it is open
        if (!res.closed) await once(res, 'close');
    }
}
