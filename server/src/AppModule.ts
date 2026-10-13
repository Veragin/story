import { Module } from '@nestjs/common';
import { NOT_YET_PORTED_ROUTES } from './common/notYetPortedRoutes';
import { ProtocolRoutesModule } from './common/ProtocolRoutesModule';
import { AppConfigModule } from './config/AppConfigModule';
import { DatabaseModule } from './database/DatabaseModule';
import { HealthModule } from './health/HealthModule';
import { StoriesModule } from './stories/StoriesModule';

@Module({
    imports: [
        AppConfigModule,
        DatabaseModule,
        ProtocolRoutesModule.forRoot(NOT_YET_PORTED_ROUTES),
        HealthModule,
        StoriesModule,
    ],
})
export class AppModule {}
