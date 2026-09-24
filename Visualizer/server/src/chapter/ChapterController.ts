import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { StoryIndexService } from '../story/StoryIndexService';
import type { TChapterSummary, TPassageSummary } from '../story/types';

/**
 * `GET /api/chapter` and `GET /api/chapter/:chapterId` (VISUALIZER_PLAN §5.3).
 *
 * §5.3 lists no `GET` for chapters, because the client gets them all from `GET /api/story` at
 * boot. Both are added anyway: the writes in Phase 5 need a way to re-read one chapter after a
 * `409`, and refetching the whole index to resolve a conflict on one file is the wrong shape.
 *
 * `…/passages` is the chapter view's first request — the passages of one chapter, with the
 * static link graph already resolved.
 */
@Controller('chapter')
export class ChapterController {
    constructor(private readonly index: StoryIndexService) {}

    @Get()
    async list(): Promise<TChapterSummary[]> {
        return await this.index.getChapters();
    }

    @Get(':chapterId')
    async one(@Param('chapterId') chapterId: string): Promise<TChapterSummary> {
        const chapter = await this.index.getChapter(chapterId);
        if (!chapter) throw new NotFoundException(`No chapter "${chapterId}"`);
        return chapter;
    }

    @Get(':chapterId/passages')
    async passages(@Param('chapterId') chapterId: string): Promise<TPassageSummary[]> {
        const chapter = await this.index.getChapter(chapterId);
        if (!chapter) throw new NotFoundException(`No chapter "${chapterId}"`);
        const passages = await this.index.getPassages();
        return passages.filter((passage) => passage.chapterId === chapterId);
    }
}
