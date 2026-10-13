import { Module } from '@nestjs/common';
import { TriggersController } from './TriggersController';

@Module({ controllers: [TriggersController] })
export class TriggersModule {}
