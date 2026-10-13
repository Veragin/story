import { Module } from '@nestjs/common';
import { CatalogsController } from './CatalogsController';

@Module({ controllers: [CatalogsController] })
export class CatalogsModule {}
