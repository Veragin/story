import { Injectable, type NestMiddleware } from '@nestjs/common';
import { GLOBAL_ROUTES, matchRoute, splitStoryPath, STORY_ROUTES } from '@story/protocol';
import type { Request, Response } from 'express';
import { HttpError } from '../common/HttpError';
import { StoryRepository } from '../stories/StoryRepository';
import { readSessionToken } from './cookie';
import { SessionService } from './SessionService';

// Express answers HEAD with the GET handler
const routeMethod = (method: string) => (method === 'HEAD' ? 'GET' : method);

const unmatchedStoryId = (requestMethod: string, pathname: string): string | null => {
    const method = routeMethod(requestMethod);
    if (matchRoute(GLOBAL_ROUTES, method, pathname)) return null;
    const scoped = splitStoryPath(pathname);
    if (!scoped || matchRoute(STORY_ROUTES, method, scoped.rest)) return null;
    return scoped.storyId;
};

// a path below a story that no route takes: like the old server, the story's lock answers before "No route"
@Injectable()
export class UnmatchedStoryPathMiddleware implements NestMiddleware {
    constructor(
        private readonly stories: StoryRepository,
        private readonly sessions: SessionService
    ) {}

    async use(req: Request, _res: Response, next: () => void): Promise<void> {
        const storyId = unmatchedStoryId(req.method, new URL(req.originalUrl, 'http://localhost').pathname);
        if (storyId !== null) {
            if (!(await this.stories.exists(storyId))) throw HttpError.noStory(storyId);
            if ((await this.sessions.expiresAt(readSessionToken(req), storyId)) === null) {
                throw HttpError.storyLocked(storyId);
            }
        }
        next();
    }
}
