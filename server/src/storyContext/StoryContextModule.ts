import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StoriesModule } from '../stories/StoriesModule';
import { StoryContexts } from './StoryContexts';
import { DEFAULT_STORY_CONTEXTS_OPTIONS, STORY_CONTEXTS_OPTIONS } from './storyContextsOptions';
import { StoryLeaseInterceptor } from './StoryLeaseInterceptor';

@Module({
    imports: [StoriesModule],
    providers: [
        { provide: STORY_CONTEXTS_OPTIONS, useValue: DEFAULT_STORY_CONTEXTS_OPTIONS },
        StoryContexts,
        { provide: APP_INTERCEPTOR, useClass: StoryLeaseInterceptor },
    ],
    exports: [StoryContexts, STORY_CONTEXTS_OPTIONS],
})
export class StoryContextModule {}
