import { Body, Controller, Delete, Headers, NotFoundException, Param, Put } from '@nestjs/common';
import { UpdateMapDto } from '../common/dto';
import { FileWatcherService } from '../events/FileWatcherService';
import { SourceFileService } from '../story/SourceFileService';
import { StoryIndexService } from '../story/StoryIndexService';
import type { TMapSummary } from '../story/types';
import { RegisterWriterService } from '../writer/RegisterWriterService';
import { TsWriterService, WriterRefusal, literal } from '../writer/TsWriterService';
import { assertStrokeBudget } from './strokeBudget';

/**
 * `PUT` and `DELETE` for maps (VISUALIZER_PLAN §5.3), including §4.3's stroke budget.
 *
 * ## The `413`
 *
 * §4.3 names three mitigations for "brush strokes are TypeScript". Two are the client's —
 * coordinates are rounded to integers and the stroke is simplified with Ramer–Douglas–Peucker
 * before it is ever sent (`BrushStroke.finish`). The third is this one, and it is deliberately
 * the server's: *"the server rejects a `strokes` payload over a configured budget (default 2 MB
 * per map) with `413` rather than writing a file no one can merge."*
 *
 * The point of doing it here rather than in the client is that it is a statement about the
 * **repository**, not about the drawing: a 3 MB source file is unreviewable and unmergeable
 * whatever produced it, and a client with a bug — or an author scripting against the API — must
 * not be able to commit one. The budget is measured on the rendered source text, because that is
 * what actually lands in the file; counting points would be measuring a proxy.
 */

@Controller('map')
export class MapWriteController {
    constructor(
        private readonly index: StoryIndexService,
        private readonly writer: TsWriterService,
        private readonly registers: RegisterWriterService,
        private readonly files: SourceFileService,
        private readonly watcher: FileWatcherService
    ) {}

    @Put(':mapId')
    async update(
        @Param('mapId') mapId: string,
        @Body() body: UpdateMapDto,
        @Headers('if-match') ifMatch?: string
    ): Promise<TMapSummary> {
        const map = await this.index.getMap(mapId);
        if (!map) throw new NotFoundException(`No map "${mapId}"`);
        if (!map.file) throw new WriterRefusal(`No file for map "${mapId}"`, mapId);

        const edits = [];

        if (body.title !== undefined) edits.push({ name: 'title', initializer: literal(body.title) });
        if (body.size !== undefined) {
            edits.push({
                name: 'size',
                initializer: literal({ width: body.size.width, height: body.size.height }),
            });
        }

        if (body.background !== undefined) {
            edits.push({
                name: 'background',
                initializer: body.background === null ? undefined : literal(body.background),
            });
        }

        if (body.notes !== undefined) {
            edits.push({
                name: 'notes',
                initializer: literal(
                    body.notes.map((note) => ({
                        id: note.id,
                        text: note.text,
                        position: { x: note.position.x, y: note.position.y },
                        rotation: note.rotation,
                        color: note.color,
                    }))
                ),
            });
        }

        if (body.strokes !== undefined) {
            const rendered = literal(
                body.strokes.map((stroke) => ({
                    id: stroke.id,
                    color: stroke.color,
                    width: stroke.width,
                    points: stroke.points,
                }))
            );

            // §4.3's third mitigation — see `strokeBudget.ts`. Throws a 413.
            assertStrokeBudget(rendered, mapId);

            edits.push({ name: 'strokes', initializer: rendered });
        }

        this.watcher.suppressNext(map.file);
        await this.writer.setProperties(map.file, exportNameForMap(mapId), edits, ifMatch ?? body.hash);

        this.index.invalidate();
        const refreshed = await this.index.getMap(mapId);
        if (!refreshed) throw new NotFoundException(`No map "${mapId}"`);
        return { ...refreshed, hash: await this.files.hashOf(map.file) };
    }

    @Delete(':mapId')
    async remove(
        @Param('mapId') mapId: string
    ): Promise<{ deleted: string; file: string; detachedLocations: string[] }> {
        const map = await this.index.getMap(mapId);
        if (!map) throw new NotFoundException(`No map "${mapId}"`);

        /**
         * A location whose `shape.mapId` names this map would be left pointing at an id that no
         * longer exists — which does not typecheck, because `TMapId` is `keyof register.maps`.
         * Refusing is the honest answer: silently stripping shapes off other files would delete
         * the author's polygons as a side effect of deleting a map.
         */
        if (map.locationIds.length > 0) {
            throw new WriterRefusal(
                `Map "${mapId}" still has ${map.locationIds.length} location(s) drawn on it (${map.locationIds.join(
                    ', '
                )}). Remove their shapes first.`,
                map.file
            );
        }

        await this.registers.removeEntry('maps', mapId);

        if (map.file) {
            this.watcher.suppressNext(map.file);
            await this.files.remove(map.file);
        }

        this.index.invalidate();
        return { deleted: mapId, file: map.file, detachedLocations: [] };
    }
}

/** `global` → `globalMap`, matching `data/maps/global.map.ts`. */
export const exportNameForMap = (mapId: string): string => `${mapId}Map`;
