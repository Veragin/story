import { Controller, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { TOkDto } from '@story/protocol';
import { ProtocolRoute } from '../common/ProtocolRoute';
import { rewriteInBulk } from '../events/rewriteInBulk';
import { MAP_FILE } from '../json/mapFile';
import { StoryFolders } from '../stories/StoryFolders';
import { storyMapSize } from '../stories/storyInput';
import { StoryZipInterceptor } from '../stories/StoryZipInterceptor';
import { type TUploadedZip, unzipUploaded } from '../stories/zip';
import type { TServerContext } from '../storyContext/serverContext';
import { StoryCtx } from '../storyContext/StoryCtx';
import { StoryReloader } from '../storyContext/StoryReloader';

@Controller()
export class StoryFilesController {
    constructor(
        private readonly folders: StoryFolders,
        private readonly reloader: StoryReloader
    ) {}

    @ProtocolRoute('addStoryFiles')
    @UseInterceptors(StoryZipInterceptor)
    async addStoryFiles(
        @StoryCtx() ctx: TServerContext,
        @UploadedFile() zip: TUploadedZip | undefined
    ): Promise<TOkDto> {
        const files = unzipUploaded(zip);
        const map = files.get(MAP_FILE);
        // refused before anything is written
        if (map) storyMapSize(map, 'zip');
        await rewriteInBulk(ctx.bus, () => this.folders.addFiles(ctx.storyId, files));
        await this.reloader.afterBulkRewrite(ctx, 'files');
        return { ok: true };
    }
}
