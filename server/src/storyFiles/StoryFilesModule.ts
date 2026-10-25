import { Module } from '@nestjs/common';
import { StoriesModule } from '../stories/StoriesModule';
import { StoryContextModule } from '../storyContext/StoryContextModule';
import { StoryFilesController } from './StoryFilesController';

@Module({
    imports: [StoriesModule, StoryContextModule],
    controllers: [StoryFilesController],
})
export class StoryFilesModule {}
