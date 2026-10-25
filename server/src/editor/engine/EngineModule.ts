import { Module } from '@nestjs/common';
import { EngineController } from './EngineController';

@Module({ controllers: [EngineController] })
export class EngineModule {}
