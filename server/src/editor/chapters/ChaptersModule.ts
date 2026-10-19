import { Module } from '@nestjs/common';
import { ChaptersController } from './ChaptersController';

@Module({ controllers: [ChaptersController] })
export class ChaptersModule {}
