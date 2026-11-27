import { Module } from '@nestjs/common';
import { AiModule } from '../../ai/AiModule';
import { ImagesController } from './ImagesController';

@Module({ imports: [AiModule], controllers: [ImagesController] })
export class ImagesModule {}
