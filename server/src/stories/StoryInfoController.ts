import { Body, Controller, Res } from '@nestjs/common';
import { STORY_ZIP_CONTENT_TYPE, type TStoryInfoDto } from '@story/protocol';
import type { Response } from 'express';
import { jsonObjectBody } from '../common/body';
import { HttpError } from '../common/HttpError';
import { ProtocolRoute } from '../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../common/RouteParams';
import { toStoryDto } from './storyFile';
import { StoryFolders } from './StoryFolders';
import { applyUpdateStoryBody, hashUpdatePassword } from './storyInput';
import { StoryRepository } from './StoryRepository';
import { StoryVersionConflictError } from './StoryVersionConflictError';

@Controller()
export class StoryInfoController {
    constructor(
        private readonly stories: StoryRepository,
        private readonly folders: StoryFolders
    ) {}

    @ProtocolRoute('getStoryInfo')
    async getStoryInfo(@RouteParams() { storyId }: THandlerParams<'getStoryInfo'>): Promise<TStoryInfoDto> {
        const current = await this.stories.readVersioned(storyId);
        if (!current) throw HttpError.noStory(storyId);
        return { ...toStoryDto(storyId, current.file), version: current.version };
    }

    @ProtocolRoute('updateStoryInfo')
    async updateStoryInfo(
        @RouteParams() { storyId }: THandlerParams<'updateStoryInfo'>,
        @Body() body: unknown
    ): Promise<TStoryInfoDto> {
        const fields = jsonObjectBody(body);
        const passwordHash = await hashUpdatePassword(fields);
        return this.stories.exclusive(async (manager) => {
            const current = await this.stories.readVersioned(storyId, manager);
            if (!current) throw HttpError.noStory(storyId);
            // stale before invalid, as the version is what the change was based on
            if (fields.version !== current.version) throw new StoryVersionConflictError(storyId);
            const next = applyUpdateStoryBody(storyId, current.file, fields, passwordHash);
            const version = await this.stories.write(storyId, next, current.version, manager);
            return { ...toStoryDto(storyId, next), version };
        });
    }

    @ProtocolRoute('exportStory')
    async exportStory(@RouteParams() { storyId }: THandlerParams<'exportStory'>, @Res() res: Response): Promise<void> {
        const story = await this.stories.read(storyId);
        if (!story) throw HttpError.noStory(storyId);
        const zip = await this.folders.exportZip(storyId, story.mapSize);
        res.writeHead(200, {
            'content-type': STORY_ZIP_CONTENT_TYPE,
            'content-disposition': `attachment; filename="${storyId}.zip"`,
            'content-length': zip.byteLength,
            'cache-control': 'no-store',
        });
        res.end(zip);
    }
}
