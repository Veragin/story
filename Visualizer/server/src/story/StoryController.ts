import { Controller, Get } from '@nestjs/common';
import { SourceFileService } from './SourceFileService';
import { StoryIndexService } from './StoryIndexService';
import type { TStoryIndex } from './types';

/**
 * `GET /api/health` and `GET /api/story` (VISUALIZER_PLAN §5.3).
 *
 * `/api/story` is "ids + titles of everything, one round trip at boot". The client's stores are
 * built around having the whole index in memory — the timeline needs every chapter, the map
 * needs every location, the graph needs every passage — and paging that out into six requests
 * would buy nothing for a story that fits comfortably in one response.
 */
@Controller()
export class StoryController {
    constructor(
        private readonly index: StoryIndexService,
        private readonly files: SourceFileService
    ) {}

    /**
     * Reports the repo root it resolved, not just `ok`. That is the one thing worth knowing
     * when the server is up but answering about the wrong story — a stale container, a second
     * checkout — and it is invisible from every other route.
     */
    @Get('health')
    health(): { status: 'ok'; repoRoot: string } {
        return { status: 'ok', repoRoot: this.files.repoRoot };
    }

    @Get('story')
    async story(): Promise<TStoryIndex> {
        return await this.index.getIndex();
    }
}
