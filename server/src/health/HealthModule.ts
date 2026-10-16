import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/DatabaseModule';
import { StoryContextModule } from '../storyContext/StoryContextModule';
import { HealthController } from './HealthController';
import { HealthService } from './HealthService';

@Module({
    imports: [DatabaseModule, StoryContextModule],
    controllers: [HealthController],
    providers: [HealthService],
})
export class HealthModule {}
