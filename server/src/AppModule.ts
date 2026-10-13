import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/AppConfigModule';
import { DatabaseModule } from './database/DatabaseModule';
import { HealthModule } from './health/HealthModule';

@Module({
    imports: [AppConfigModule, DatabaseModule, HealthModule],
})
export class AppModule {}
