import { Body, Controller, Inject, Req, Res } from '@nestjs/common';
import type { TSessionDto, TStoryAccessDto } from '@story/protocol';
import type { Request, Response } from 'express';
import { jsonObjectBody, requireString } from '../common/body';
import { HttpError } from '../common/HttpError';
import { ProtocolRoute } from '../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../common/RouteParams';
import { StoryRepository } from '../stories/StoryRepository';
import { AUTH_OPTIONS, type TAuthOptions } from './authOptions';
import { clearedSessionCookie, readSessionToken, sessionCookie } from './cookie';
import { clientAddress, LoginLimiter, loginKey } from './LoginLimiter';
import { verifyPassword } from './password';
import { SessionService } from './SessionService';

@Controller()
export class AuthController {
    constructor(
        private readonly stories: StoryRepository,
        private readonly sessions: SessionService,
        private readonly loginLimiter: LoginLimiter,
        @Inject(AUTH_OPTIONS) private readonly options: TAuthOptions
    ) {}

    @ProtocolRoute('login')
    async login(
        @RouteParams() { storyId }: THandlerParams<'login'>,
        @Body() body: unknown,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<void> {
        const password = requireString(jsonObjectBody(body), 'password');
        const story = await this.stories.read(storyId);
        if (!story) throw HttpError.noStory(storyId);
        const key = loginKey(clientAddress(req, this.options.trustProxy), storyId);
        if (this.loginLimiter.isBlocked(key)) {
            throw HttpError.tooManyRequests('Too many wrong passwords, try again in a few minutes');
        }
        if (!(await verifyPassword(password, story.password))) {
            this.loginLimiter.fail(key);
            throw HttpError.unauthorized('Wrong password');
        }
        this.loginLimiter.succeed(key);
        const { token } = await this.sessions.grant(readSessionToken(req), storyId);
        res.setHeader('set-cookie', sessionCookie(token, this.options.cookieSecure));
    }

    @ProtocolRoute('logout')
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
        await this.sessions.revoke(readSessionToken(req));
        res.setHeader('set-cookie', clearedSessionCookie(this.options.cookieSecure));
    }

    @ProtocolRoute('getSession')
    async getSession(@Req() req: Request): Promise<TSessionDto> {
        return { storyIds: await this.sessions.storyIds(readSessionToken(req)) };
    }

    @ProtocolRoute('getStoryAccess')
    async getStoryAccess(
        @RouteParams() { storyId }: THandlerParams<'getStoryAccess'>,
        @Req() req: Request
    ): Promise<TStoryAccessDto> {
        const story = await this.stories.read(storyId);
        if (!story) throw HttpError.noStory(storyId);
        const canEdit = (await this.sessions.expiresAt(readSessionToken(req), storyId)) !== null;
        return { canEdit, canPlay: canEdit || story.public };
    }
}
