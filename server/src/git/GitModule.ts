import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/DatabaseModule';
import { StoriesModule } from '../stories/StoriesModule';
import { StoryContextModule } from '../storyContext/StoryContextModule';
import { GitAvailability } from './GitAvailability';
import { GitController } from './GitController';
import { GitLocks } from './GitLocks';
import { GIT_OPTIONS, gitOptionsFromConfig } from './gitOptions';
import { GitService } from './GitService';

@Module({
    imports: [DatabaseModule, StoriesModule, StoryContextModule],
    controllers: [GitController],
    providers: [
        { provide: GIT_OPTIONS, inject: [ConfigService], useFactory: gitOptionsFromConfig },
        GitAvailability,
        GitLocks,
        GitService,
    ],
    exports: [GitAvailability],
})
export class GitModule {}
