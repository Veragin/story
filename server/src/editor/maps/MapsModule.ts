import { Module } from '@nestjs/common';
import { StoryRepositoryModule } from '../../stories/StoryRepositoryModule';
import { MapsController } from './MapsController';

@Module({ imports: [StoryRepositoryModule], controllers: [MapsController] })
export class MapsModule {}
