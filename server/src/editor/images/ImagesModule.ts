import { Module } from '@nestjs/common';
import { ImagesController } from './ImagesController';

@Module({ controllers: [ImagesController] })
export class ImagesModule {}
