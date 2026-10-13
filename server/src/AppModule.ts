import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/AppConfigModule';
import { DatabaseModule } from './database/DatabaseModule';
import { HealthModule } from './health/HealthModule';
import { StoriesModule } from './stories/StoriesModule';

@Module({
    imports: [AppConfigModule, DatabaseModule, HealthModule, StoriesModule],
})
export class AppModule {}
