import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/AuthModule';
import { StoriesController } from './StoriesController';
import { STORIES_ROOT, storiesRootFromConfig } from './storiesRoot';
import { StoryFolders } from './StoryFolders';
import { StoryInfoController } from './StoryInfoController';
import { StoryRepositoryModule } from './StoryRepositoryModule';

@Module({
    imports: [StoryRepositoryModule, AuthModule],
    controllers: [StoriesController, StoryInfoController],
    providers: [{ provide: STORIES_ROOT, inject: [ConfigService], useFactory: storiesRootFromConfig }, StoryFolders],
    exports: [STORIES_ROOT, StoryFolders],
})
export class StoriesModule {}
