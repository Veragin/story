import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { catchError, from, type Observable } from 'rxjs';
import { HttpError } from '../common/HttpError';
import { StoryRepository } from '../database/repositories/StoryRepository';
import { StoryFolders } from './StoryFolders';
import { buildStoryInfo } from './storyInfo';
import { StoryVersionConflictError } from './StoryVersionConflictError';

// a stale `version` answers 409 `stale` with the story info as it is now, like the file-based server did
@Injectable()
export class StoryVersionConflictInterceptor implements NestInterceptor {
    constructor(
        private readonly stories: StoryRepository,
        private readonly folders: StoryFolders
    ) {}

    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return next.handle().pipe(catchError((e: unknown) => from(this.rethrow(e))));
    }

    private async rethrow(e: unknown): Promise<never> {
        if (!(e instanceof StoryVersionConflictError)) throw e;
        const current = await this.stories.readVersioned(e.storyId);
        if (!current) throw HttpError.noStory(e.storyId);
        throw HttpError.stale(await buildStoryInfo(e.storyId, current, this.folders.dir(e.storyId)));
    }
}
