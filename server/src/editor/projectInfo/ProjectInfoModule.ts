import { Module } from '@nestjs/common';
import { ProjectInfoController } from './ProjectInfoController';

@Module({ controllers: [ProjectInfoController] })
export class ProjectInfoModule {}
