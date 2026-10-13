import { Module } from '@nestjs/common';
import { PassagesController } from './PassagesController';

@Module({ controllers: [PassagesController] })
export class PassagesModule {}
