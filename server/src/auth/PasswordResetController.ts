import { Body, Controller, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { jsonObjectBody, requireString } from '../common/body';
import { HttpError } from '../common/HttpError';
import { ProtocolRoute } from '../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../common/RouteParams';
import { DatabaseService } from '../database/DatabaseService';
import { SessionGrantRepository } from '../database/repositories/SessionGrantRepository';
import { StoryPasswordResetRepository } from '../database/repositories/StoryPasswordResetRepository';
import { StoryRepository } from '../database/repositories/StoryRepository';
import { Mailer } from '../mail/Mailer';
import { password } from '../stories/storyInput';
import { AUTH_OPTIONS, type TAuthOptions } from './authOptions';
import { readSessionToken, sessionCookie } from './cookie';
import { clientAddress, LoginLimiter, loginKey } from './LoginLimiter';
import { hashPassword } from './password';
import {
    isStoryEmailMatch,
    PASSWORD_RESET_OPTIONS,
    RESET_REQUEST_LIMITER,
    RESET_TOKEN_TTL_MS,
    resetLink,
    resetMail,
    type TPasswordResetOptions,
} from './passwordReset';
import { hashToken, newToken, SessionService } from './SessionService';

@Controller()
export class PasswordResetController {
    constructor(
        private readonly database: DatabaseService,
        private readonly stories: StoryRepository,
        private readonly resets: StoryPasswordResetRepository,
        private readonly grants: SessionGrantRepository,
        private readonly sessions: SessionService,
        private readonly mailer: Mailer,
        private readonly loginLimiter: LoginLimiter,
        @Inject(RESET_REQUEST_LIMITER) private readonly requestLimiter: LoginLimiter,
        @Inject(AUTH_OPTIONS) private readonly options: TAuthOptions,
        @Inject(PASSWORD_RESET_OPTIONS) private readonly resetOptions: TPasswordResetOptions
    ) {}

    private keyOf(req: Request, storyId: string) {
        return loginKey(clientAddress(req, this.options.trustProxy), storyId);
    }

    @ProtocolRoute('requestPasswordReset')
    async requestPasswordReset(
        @RouteParams() { storyId }: THandlerParams<'requestPasswordReset'>,
        @Body() body: unknown,
        @Req() req: Request
    ): Promise<void> {
        const email = requireString(jsonObjectBody(body), 'email');
        const key = this.keyOf(req, storyId);
        if (this.requestLimiter.isBlocked(key)) {
            throw HttpError.tooManyRequests('Too many password reset requests, try again in a few minutes');
        }
        this.requestLimiter.fail(key);
        const story = await this.stories.read(storyId);
        if (!story) throw HttpError.noStory(storyId);
        // the same 204 as a match: the answer must not reveal the story's email
        if (!isStoryEmailMatch(story.email, email)) {
            await this.resetOptions.wrongEmailDelay();
            return;
        }
        const token = newToken();
        await this.resets.replace(storyId, hashToken(token), new Date(Date.now() + RESET_TOKEN_TTL_MS));
        const link = resetLink(this.resetOptions.publicUrl, storyId, token);
        try {
            await this.mailer.send({ to: story.email, ...resetMail(story.name, link) });
        } catch (e) {
            console.error('[mail] the password reset mail was not sent', e);
            throw HttpError.of('internal', 'The mail could not be sent, try again later');
        }
    }

    @ProtocolRoute('resetPassword')
    async resetPassword(
        @RouteParams() { storyId }: THandlerParams<'resetPassword'>,
        @Body() body: unknown,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<void> {
        const fields = jsonObjectBody(body);
        const tokenHash = hashToken(requireString(fields, 'token'));
        const passwordHash = await hashPassword(password(fields.password));
        await this.database.transaction(async (manager) => {
            if (!(await this.resets.findLive(storyId, tokenHash, new Date(), manager))) {
                throw HttpError.badRequest('The link is invalid or has expired');
            }
            await this.stories.setPassword(storyId, passwordHash, manager);
            await this.resets.delete(storyId, manager);
            await this.grants.deleteForStory(storyId, manager);
        });
        const { token } = await this.sessions.grant(readSessionToken(req, this.options.cookieSecure), storyId);
        res.setHeader('set-cookie', sessionCookie(token, this.options.cookieSecure));
        this.loginLimiter.succeed(this.keyOf(req, storyId));
    }
}
