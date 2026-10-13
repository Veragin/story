import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/AuthModule';
import { ApiExceptionFilter } from './common/ApiExceptionFilter';
import { JsonBodyInterceptor } from './common/JsonBodyInterceptor';
import { JsonResponseInterceptor } from './common/JsonResponseInterceptor';
import { NOT_YET_PORTED_ROUTES } from './common/notYetPortedRoutes';
import { ProtocolRoutesModule } from './common/ProtocolRoutesModule';
import { AppConfigModule } from './config/AppConfigModule';
import { DatabaseModule } from './database/DatabaseModule';
import { ProjectInfoModule } from './editor/projectInfo/ProjectInfoModule';
import { ChaptersModule } from './editor/chapters/ChaptersModule';
import { PassagesModule } from './editor/passages/PassagesModule';
import { TriggersModule } from './editor/triggers/TriggersModule';
import { EntitiesModule } from './editor/entities/EntitiesModule';
import { CatalogsModule } from './editor/catalogs/CatalogsModule';
import { StructureModule } from './editor/structure/StructureModule';
import { SourceModule } from './editor/source/SourceModule';
import { ImagesModule } from './editor/images/ImagesModule';
import { LayoutsModule } from './editor/layouts/LayoutsModule';
import { MapsModule } from './editor/maps/MapsModule';
import { EventsModule } from './events/EventsModule';
import { HealthModule } from './health/HealthModule';
import { StoryContextModule } from './storyContext/StoryContextModule';
import { StoriesModule } from './stories/StoriesModule';

@Module({
    imports: [
        AppConfigModule,
        DatabaseModule,
        ScheduleModule.forRoot(),
        ProtocolRoutesModule.forRoot(NOT_YET_PORTED_ROUTES),
        HealthModule,
        StoriesModule,
        AuthModule,
        StoryContextModule,
        EventsModule,
        ProjectInfoModule,
        ChaptersModule,
        PassagesModule,
        TriggersModule,
        EntitiesModule,
        CatalogsModule,
        StructureModule,
        SourceModule,
        ImagesModule,
        MapsModule,
        LayoutsModule,
    ],
    providers: [
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: JsonResponseInterceptor },
        { provide: APP_INTERCEPTOR, useClass: JsonBodyInterceptor },
    ],
})
export class AppModule {}
