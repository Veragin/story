import { Module } from '@nestjs/common';
import { EventsController } from './EventsController';

@Module({ controllers: [EventsController] })
export class EventsModule {}
