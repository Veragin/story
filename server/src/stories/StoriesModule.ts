import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StoryRepository } from './StoryRepository';
import { StoryVersionConflictInterceptor } from './StoryVersionConflictInterceptor';

@Module({
    providers: [StoryRepository, { provide: APP_INTERCEPTOR, useClass: StoryVersionConflictInterceptor }],
    exports: [StoryRepository],
})
export class StoriesModule {}
