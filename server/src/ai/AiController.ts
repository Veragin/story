import { once } from 'node:events';
import { Body, Controller, Req, Res } from '@nestjs/common';
import type { TAiDto, TAiSessionDto, TOkDto } from '@story/protocol';
import type { Request, Response } from 'express';
import { storyGrantOf } from '../auth/storyGrant';
import { ProtocolRoute } from '../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../common/RouteParams';
import { AiService } from './AiService';

@Controller()
export class AiController {
    constructor(private readonly ai: AiService) {}

    @ProtocolRoute('getAi')
    getAi(@RouteParams() { storyId }: THandlerParams<'getAi'>): Promise<TAiDto> {
        return this.ai.getAi(storyId);
    }

    @ProtocolRoute('aiEvents')
    async aiEvents(
        @RouteParams() { storyId }: THandlerParams<'aiEvents'>,
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        await this.ai.events(storyId, res, storyGrantOf(req));
        // settling only when the stream closes holds the story lease, and so its watcher, while it is open
        if (!res.closed) await once(res, 'close');
    }

    @ProtocolRoute('sendAiMessage')
    sendAiMessage(@RouteParams() { storyId }: THandlerParams<'sendAiMessage'>, @Body() body: unknown): Promise<TOkDto> {
        return this.ai.send(storyId, body);
    }

    @ProtocolRoute('interruptAi')
    interruptAi(@RouteParams() { storyId }: THandlerParams<'interruptAi'>): Promise<TOkDto> {
        return this.ai.interrupt(storyId);
    }

    @ProtocolRoute('listAiSessions')
    listAiSessions(@RouteParams() { storyId }: THandlerParams<'listAiSessions'>): Promise<TAiSessionDto[]> {
        return this.ai.listSessions(storyId);
    }

    @ProtocolRoute('resumeAi')
    resumeAi(@RouteParams() { storyId }: THandlerParams<'resumeAi'>, @Body() body: unknown): Promise<TOkDto> {
        return this.ai.resume(storyId, body);
    }

    @ProtocolRoute('clearAi')
    clearAi(@RouteParams() { storyId }: THandlerParams<'clearAi'>): Promise<TOkDto> {
        return this.ai.clear(storyId);
    }
}
