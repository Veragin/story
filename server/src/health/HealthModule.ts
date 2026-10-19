import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/DatabaseModule';
import { GitModule } from '../git/GitModule';
import { StoryContextModule } from '../storyContext/StoryContextModule';
import { HealthController } from './HealthController';
import { HealthService } from './HealthService';

@Module({
    imports: [DatabaseModule, StoryContextModule, GitModule],
    controllers: [HealthController],
    providers: [HealthService],
})
export class HealthModule {}
