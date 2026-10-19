import { Module } from '@nestjs/common';
import { LayoutsController } from './LayoutsController';

@Module({ controllers: [LayoutsController] })
export class LayoutsModule {}
