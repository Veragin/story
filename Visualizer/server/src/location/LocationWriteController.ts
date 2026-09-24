import { Body, Controller, Delete, Headers, NotFoundException, Param, Put } from '@nestjs/common';
import { UpdateLocationDto } from '../common/dto';
import { FileWatcherService } from '../events/FileWatcherService';
import { SourceFileService } from '../story/SourceFileService';
import { StoryIndexService } from '../story/StoryIndexService';
import type { TLocationSummary } from '../story/types';
import { RegisterWriterService } from '../writer/RegisterWriterService';
import { TsWriterService, WriterRefusal, literal } from '../writer/TsWriterService';

/**
 * `PUT` and `DELETE` for locations (VISUALIZER_PLAN §5.3).
 *
 * `PUT` is the map tab's save path: it writes `shape` — the polygon, its colour and its z — into
 * `data/locations/<id>.location.ts`, alongside the name and description the location form edits.
 * One property-level edit per field (§4.5 rule 2); the rest of the file, including the
 * `TVillageLocationData` type alias below the export, is untouched.
 *
 * ## `shape: undefined` and `shape: null` mean different things
 *
 * Absent leaves the polygon alone — a client saving only the name must not erase the geometry by
 * omission. `null` removes it, which is how a location is taken off the map. This is the
 * distinction a naive `Object.assign` writer loses, and losing it means the map tab silently
 * deletes shapes every time the location form is saved.
 */
@Controller('location')
export class LocationWriteController {
    constructor(
        private readonly index: StoryIndexService,
        private readonly writer: TsWriterService,
        private readonly registers: RegisterWriterService,
        private readonly files: SourceFileService,
        private readonly watcher: FileWatcherService
    ) {}

    @Put(':locationId')
    async update(
        @Param('locationId') locationId: string,
        @Body() body: UpdateLocationDto,
        @Headers('if-match') ifMatch?: string
    ): Promise<TLocationSummary> {
        const location = await this.index.getLocation(locationId);
        if (!location) throw new NotFoundException(`No location "${locationId}"`);
        if (!location.file) throw new WriterRefusal(`No file for location "${locationId}"`, locationId);

        const edits = [];

        if (body.name !== undefined) edits.push({ name: 'name', initializer: literal(body.name) });
        if (body.description !== undefined) {
            edits.push({ name: 'description', initializer: literal(body.description) });
        }

        if (body.shape !== undefined) {
            if (body.shape === null) {
                edits.push({ name: 'shape', initializer: undefined });
            } else {
                if (body.shape.points.length < 3) {
                    throw new WriterRefusal(
                        `A location shape needs at least 3 points, got ${body.shape.points.length}`,
                        location.file
                    );
                }
                edits.push({
                    name: 'shape',
                    initializer: literal({
                        mapId: body.shape.mapId,
                        points: body.shape.points.map((point) => ({ x: point.x, y: point.y })),
                        color: body.shape.color,
                        z: body.shape.z,
                    }),
                });
            }
        }

        // Suppress before the write, so the resulting watcher event is not echoed back to the
        // client that caused it — see `FileWatcherService`.
        this.watcher.suppressNext(location.file);
        await this.writer.setProperties(location.file, exportNameFor(locationId), edits, ifMatch ?? body.hash);

        // Re-read rather than patching the cached summary: the file is the source of truth, and
        // the response carries the new hash the client's next `If-Match` needs.
        this.index.invalidate();
        return this.reread(locationId, location.file);
    }

    @Delete(':locationId')
    async remove(@Param('locationId') locationId: string): Promise<{ deleted: string; file: string }> {
        const location = await this.index.getLocation(locationId);
        if (!location) throw new NotFoundException(`No location "${locationId}"`);

        // Register entry first. If the file were deleted first and this failed, the story would
        // be left importing a file that no longer exists — which does not typecheck and does
        // not boot. This order leaves at worst an orphaned file, which is harmless.
        await this.registers.removeEntry('locations', locationId);

        if (location.file) {
            this.watcher.suppressNext(location.file);
            await this.files.remove(location.file);
        }

        this.index.invalidate();
        return { deleted: locationId, file: location.file };
    }

    /**
     * Re-reads a location after a write.
     *
     * Note the caveat this hides: `StoryIndexService` reads chapters, locations and maps from
     * the *imported* `register`, and ESM module records are immutable for a process's lifetime.
     * So the re-read answers the pre-write value until the dev server restarts — which
     * `--watch` does, on this very file change. The `hash` is read from disk and is always
     * current, so the client's next `If-Match` is correct either way.
     */
    private async reread(locationId: string, file: string): Promise<TLocationSummary> {
        const refreshed = await this.index.getLocation(locationId);
        const hash = await this.files.hashOf(file);
        if (!refreshed) throw new NotFoundException(`No location "${locationId}"`);
        return { ...refreshed, hash };
    }
}

/**
 * The exported symbol for a location id: `village` → `villageLocation`.
 *
 * A convention, not a lookup, and it is the one the story already follows. A file that breaks it
 * produces a `WriterRefusal` naming the symbol that was looked for, which is a better failure
 * than silently editing the wrong export.
 */
export const exportNameFor = (locationId: string): string => `${locationId}Location`;
