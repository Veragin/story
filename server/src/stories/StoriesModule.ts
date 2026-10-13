import { Module } from '@nestjs/common';
import { StoryRepository } from './StoryRepository';

@Module({
    providers: [StoryRepository],
    exports: [StoryRepository],
})
export class StoriesModule {}
