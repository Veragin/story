import { Module } from '@nestjs/common';
import { StructureController } from './StructureController';

@Module({ controllers: [StructureController] })
export class StructureModule {}
