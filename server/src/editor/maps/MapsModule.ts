import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/DatabaseModule';
import { MapsController } from './MapsController';

@Module({ imports: [DatabaseModule], controllers: [MapsController] })
export class MapsModule {}
