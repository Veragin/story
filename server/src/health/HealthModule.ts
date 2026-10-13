import { Module } from '@nestjs/common';
import { HealthController } from './HealthController';
import { HealthService } from './HealthService';

@Module({
    controllers: [HealthController],
    providers: [HealthService],
})
export class HealthModule {}
