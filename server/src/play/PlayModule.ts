import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/DatabaseModule';
import { PlayController } from './PlayController';

@Module({ imports: [DatabaseModule], controllers: [PlayController] })
export class PlayModule {}
