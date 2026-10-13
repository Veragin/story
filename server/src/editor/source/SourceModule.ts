import { Module } from '@nestjs/common';
import { SourceController } from './SourceController';

@Module({ controllers: [SourceController] })
export class SourceModule {}
