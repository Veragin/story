import { Module } from '@nestjs/common';
import { EntitiesController } from './EntitiesController';

@Module({ controllers: [EntitiesController] })
export class EntitiesModule {}
