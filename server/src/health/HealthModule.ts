import { Module } from '@nestjs/common';
import { StoryContextModule } from '../storyContext/StoryContextModule';
import { HealthController } from './HealthController';
import { HealthService } from './HealthService';

@Module({
    imports: [StoryContextModule],
    controllers: [HealthController],
    providers: [HealthService],
})
export class HealthModule {}
