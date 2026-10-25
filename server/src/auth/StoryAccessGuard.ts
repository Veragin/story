import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isStoryRouteName, routeDef, STORY_ID_PARAM } from '@story/protocol';
import type { Request } from 'express';
import { HttpError } from '../common/HttpError';
import { ProtocolRouteName } from '../common/ProtocolRoute';
import { StoryRepository } from '../database/repositories/StoryRepository';
import { AUTH_OPTIONS, type TAuthOptions } from './authOptions';
import { readSessionToken } from './cookie';
import { SessionService } from './SessionService';
import { attachStoryGrant } from './storyGrant';

@Injectable()
export class StoryAccessGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly stories: StoryRepository,
        private readonly sessions: SessionService,
        @Inject(AUTH_OPTIONS) private readonly options: TAuthOptions
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const route = this.reflector.get(ProtocolRouteName, context.getHandler());
        if (route === undefined || !isStoryRouteName(route)) return true;
        const { access } = routeDef(route);
        if (access === 'public') return true;

        const req = context.switchToHttp().getRequest<Request>();
        const storyId = req.params[STORY_ID_PARAM];
        if (typeof storyId !== 'string') throw new Error(`${route}: no path parameter "${STORY_ID_PARAM}"`);
        const story = await this.stories.read(storyId);
        if (!story) throw HttpError.noStory(storyId);

        const expiresAt = await this.sessions.expiresAt(readSessionToken(req, this.options.cookieSecure), storyId);
        if (expiresAt !== null) {
            attachStoryGrant(req, { expiresAt });
            return true;
        }
        if (access === 'read' && story.public) return true;
        throw HttpError.storyLocked(storyId);
    }
}
