import { Module } from '@nestjs/common';
import { ChapterController } from './chapter/ChapterController';
import { ChapterWriteController } from './chapter/ChapterWriteController';
import { EditorController } from './editor/EditorController';
import { EntityController } from './entity/EntityController';
import { EntityService } from './entity/EntityService';
import { StructureController } from './structure/StructureController';
import { StructureService } from './structure/StructureService';
import { TypecheckService } from './structure/TypecheckService';
import { EditorService } from './editor/EditorService';
import { EventsController } from './events/EventsController';
import { FileWatcherService } from './events/FileWatcherService';
import { LocationController } from './location/LocationController';
import { LocationWriteController } from './location/LocationWriteController';
import { MapController } from './map/MapController';
import { MapWriteController } from './map/MapWriteController';
import { PassageController } from './passage/PassageController';
import { PassageWriteController } from './passage/PassageWriteController';
import { SourceFileService } from './story/SourceFileService';
import { StoryController } from './story/StoryController';
import { StoryIndexService } from './story/StoryIndexService';
import { FormatterService } from './writer/FormatterService';
import { RegisterWriterService } from './writer/RegisterWriterService';
import { TsWriterService } from './writer/TsWriterService';

/**
 * The whole application graph, in one module (VISUALIZER_PLAN §5.1).
 *
 * §5.1 sketches "one Nest module each" per domain. One module is used instead, and the reason is
 * that Nest's feature modules exist to control *visibility* — which providers a controller can
 * see — and here every controller legitimately needs the same handful of services. Splitting
 * would mean either re-exporting those from a shared module into six others, or six modules that
 * all import the same one: the ceremony of encapsulation with none of its effect. The folder
 * structure still carries the domain split, which is where it is actually useful — for finding
 * things.
 *
 * Read and write controllers are separate classes sharing a route prefix. Nest merges them, and
 * the split keeps the read path — which every view hits constantly — free of the writer
 * dependencies, so it stays obvious at a glance which routes can touch the author's files.
 *
 * The services are singletons by Nest's default scope, which the design depends on: the index
 * cache and the watcher's suppression window are per-process state, and a request-scoped
 * `StoryIndexService` would rebuild the index on every request.
 */
@Module({
    controllers: [
        StoryController,

        ChapterController,
        ChapterWriteController,

        PassageController,
        PassageWriteController,

        LocationController,
        LocationWriteController,

        MapController,
        MapWriteController,

        EntityController,
        StructureController,

        EditorController,
        EventsController,
    ],
    providers: [
        SourceFileService,
        StoryIndexService,
        FileWatcherService,
        EditorService,
        FormatterService,
        TsWriterService,
        RegisterWriterService,
        EntityService,
        StructureService,
        TypecheckService,
    ],
})
export class AppModule {}
