import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/AuthModule';
import { DatabaseModule } from '../database/DatabaseModule';
import { StoriesController } from './StoriesController';
import { STORIES_ROOT, storiesRootFromConfig } from './storiesRoot';
import { StoryFolders } from './StoryFolders';
import { StoryInfoController } from './StoryInfoController';
import { StoryLifecycle } from './StoryLifecycle';
import { StoryVersionConflictInterceptor } from './StoryVersionConflictInterceptor';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [StoriesController, StoryInfoController],
    providers: [
        { provide: STORIES_ROOT, inject: [ConfigService], useFactory: storiesRootFromConfig },
        StoryFolders,
        StoryLifecycle,
        { provide: APP_INTERCEPTOR, useClass: StoryVersionConflictInterceptor },
    ],
    exports: [STORIES_ROOT, StoryFolders, StoryLifecycle],
})
export class StoriesModule {}
