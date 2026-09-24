import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { StoryIndexService } from '../story/StoryIndexService';
import type { TLocationSummary } from '../story/types';

/**
 * `GET /api/location` and `GET /api/location/:locationId` (VISUALIZER_PLAN §5.3).
 *
 * Read-only in Phase 4. The `shape` field — the polygon the map tab draws — is part of the
 * location, not of the map (§4.2), so this is where the map tab gets its geometry.
 */
@Controller('location')
export class LocationController {
    constructor(private readonly index: StoryIndexService) {}

    @Get()
    async list(): Promise<TLocationSummary[]> {
        return await this.index.getLocations();
    }

    @Get(':locationId')
    async one(@Param('locationId') locationId: string): Promise<TLocationSummary> {
        const location = await this.index.getLocation(locationId);
        if (!location) throw new NotFoundException(`No location "${locationId}"`);
        return location;
    }
}
