import { Controller, NotFoundException, Param, Post } from '@nestjs/common';
import { StoryIndexService } from '../story/StoryIndexService';
import { EditorService } from './EditorService';

/**
 * The `POST …/open` routes (VISUALIZER_PLAN §5.3).
 *
 * §5.3 hangs `open` off each resource — `POST /api/chapter/:id/open`,
 * `POST /api/location/:id/open`, `POST /api/passage/:type/:id/open`. They are gathered here
 * rather than spread across four controllers because they are one behaviour with four ways of
 * finding a file, and keeping them together is what stops the fourth one from being forgotten.
 *
 * Every route answers `{ opened }` rather than failing when the editor is missing — see
 * `EditorService` for why a missing `code` binary is not a server error.
 */
@Controller()
export class EditorController {
    constructor(
        private readonly index: StoryIndexService,
        private readonly editor: EditorService
    ) {}

    @Post('chapter/:chapterId/open')
    async openChapter(@Param('chapterId') chapterId: string): Promise<{ opened: boolean; file: string }> {
        const chapter = await this.index.getChapter(chapterId);
        if (!chapter?.file) throw new NotFoundException(`No file for chapter "${chapterId}"`);
        return this.openAt(chapter.file, this.index.lineOfExport(chapter.file, `${chapterId}Chapter`));
    }

    @Post('location/:locationId/open')
    async openLocation(@Param('locationId') locationId: string): Promise<{ opened: boolean; file: string }> {
        const location = await this.index.getLocation(locationId);
        if (!location?.file) throw new NotFoundException(`No file for location "${locationId}"`);
        return this.openAt(location.file, this.index.lineOfExport(location.file, `${locationId}Location`));
    }

    @Post('map/:mapId/open')
    async openMap(@Param('mapId') mapId: string): Promise<{ opened: boolean; file: string }> {
        const map = await this.index.getMap(mapId);
        if (!map?.file) throw new NotFoundException(`No file for map "${mapId}"`);
        return this.openAt(map.file, this.index.lineOfExport(map.file, `${mapId}Map`));
    }

    /**
     * The passage route carries its type for symmetry with the rest of `/api/passage/:type/:id`,
     * but does not check it: opening a file the author asked for should not fail because the
     * client's idea of its type was stale.
     */
    @Post('passage/:type/:passageId/open')
    async openPassage(@Param('passageId') passageId: string): Promise<{ opened: boolean; file: string }> {
        const passage = await this.index.getPassage(passageId);
        if (!passage?.file) throw new NotFoundException(`No file for passage "${passageId}"`);
        // The indexer already recorded the declaration's line while parsing.
        return this.openAt(passage.file, passage.line);
    }

    private async openAt(file: string, line: number): Promise<{ opened: boolean; file: string }> {
        const opened = await this.editor.open(file, line);
        return { opened, file };
    }
}
