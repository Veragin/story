import { readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import type { TStoryEventReason } from '@story/protocol';
import { isHttpError } from '../common/HttpError';
import { StoryRepository } from '../database/repositories/StoryRepository';
import { isMissingFileError } from '../json/atomicWrite';
import { storyMapSize } from '../stories/storyInput';
import type { TServerContext } from './serverContext';
import { StoryContexts } from './StoryContexts';

@Injectable()
export class StoryReloader {
    constructor(
        private readonly contexts: StoryContexts,
        private readonly stories: StoryRepository
    ) {}

    // the story's files changed in bulk (git, added files): always reloaded, since the change may bring another
    // tsconfig.json or an older layout (git setup also swaps the folder under the watcher)
    async afterBulkRewrite(ctx: TServerContext, reason: TStoryEventReason): Promise<void> {
        await this.contexts.reload(ctx.storyId);
        await this.syncMapSize(ctx);
        ctx.bus.emitStory({ type: 'story', reason });
    }

    private async syncMapSize(ctx: TServerContext): Promise<void> {
        const size = await this.mapSizeOnDisk(ctx);
        if (size === null) return;
        await this.stories.exclusive(async (manager) => {
            const current = await this.stories.readVersioned(ctx.storyId, manager);
            if (!current) return;
            const { width, height } = current.file.mapSize;
            if (width === size.width && height === size.height) return;
            await this.stories.write(ctx.storyId, { ...current.file, mapSize: size }, current.version, manager);
        });
    }

    // a missing or invalid map keeps the stored size
    private async mapSizeOnDisk(ctx: TServerContext) {
        try {
            return storyMapSize(await readFile(ctx.project.paths.map), 'story');
        } catch (e) {
            if (isMissingFileError(e) || isHttpError(e)) return null;
            throw e;
        }
    }
}
