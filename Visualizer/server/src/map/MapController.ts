import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { StoryIndexService } from '../story/StoryIndexService';
import type { TMapSummary } from '../story/types';

/**
 * `GET /api/map` and `GET /api/map/:mapId` (VISUALIZER_PLAN §5.3).
 *
 * Read-only in Phase 4; `PUT` and `DELETE` arrive with the writers in Phase 5.
 *
 * A map response carries `locationIds` — the locations whose `shape.mapId` names it — so
 * opening the map tab is one request rather than one per location. The denormalisation is the
 * index's, not this controller's.
 */
@Controller('map')
export class MapController {
    constructor(private readonly index: StoryIndexService) {}

    @Get()
    async list(): Promise<TMapSummary[]> {
        return await this.index.getMaps();
    }

    @Get(':mapId')
    async one(@Param('mapId') mapId: string): Promise<TMapSummary> {
        const map = await this.index.getMap(mapId);
        if (!map) throw new NotFoundException(`No map "${mapId}"`);
        return map;
    }
}
