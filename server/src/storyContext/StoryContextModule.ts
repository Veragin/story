import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../database/DatabaseModule';
import { StoriesModule } from '../stories/StoriesModule';
import { StoryContexts } from './StoryContexts';
import { DEFAULT_STORY_CONTEXTS_OPTIONS, STORY_CONTEXTS_OPTIONS } from './storyContextsOptions';
import { StoryLeaseInterceptor } from './StoryLeaseInterceptor';
import { StoryReloader } from './StoryReloader';

@Module({
    imports: [DatabaseModule, StoriesModule],
    providers: [
        { provide: STORY_CONTEXTS_OPTIONS, useValue: DEFAULT_STORY_CONTEXTS_OPTIONS },
        StoryContexts,
        StoryReloader,
        { provide: APP_INTERCEPTOR, useClass: StoryLeaseInterceptor },
    ],
    exports: [StoryContexts, StoryReloader, STORY_CONTEXTS_OPTIONS],
})
export class StoryContextModule {}
