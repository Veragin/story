import { Body, Controller, Req, Res } from '@nestjs/common';
import { STORY_ZIP_CONTENT_TYPE, type TEditStoryInfoDto, type TStoryInfoDto } from '@story/protocol';
import type { Request, Response } from 'express';
import { storyGrantOf } from '../auth/storyGrant';
import { sendAttachment } from '../common/attachment';
import { jsonObjectBody } from '../common/body';
import { HttpError } from '../common/HttpError';
import { ProtocolRoute } from '../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../common/RouteParams';
import { StoryFolders } from './StoryFolders';
import { buildStoryInfo, publicStoryInfo } from './storyInfo';
import { applyUpdateStoryBody, hashUpdatePassword } from './storyInput';
import { StoryGitRepository } from '../database/repositories/StoryGitRepository';
import { StoryRepository } from '../database/repositories/StoryRepository';
import { StoryVersionConflictError } from './StoryVersionConflictError';

@Controller()
export class StoryInfoController {
    constructor(
        private readonly stories: StoryRepository,
        private readonly storyGit: StoryGitRepository,
        private readonly folders: StoryFolders
    ) {}

    @ProtocolRoute('getStoryInfo')
    async getStoryInfo(
        @RouteParams() { storyId }: THandlerParams<'getStoryInfo'>,
        @Req() req: Request
    ): Promise<TStoryInfoDto> {
        const current = await this.stories.readVersioned(storyId);
        if (!current) throw HttpError.noStory(storyId);
        return storyGrantOf(req)
            ? buildStoryInfo(storyId, current, this.folders.dir(storyId))
            : publicStoryInfo(storyId, current.file);
    }

    @ProtocolRoute('updateStoryInfo')
    async updateStoryInfo(
        @RouteParams() { storyId }: THandlerParams<'updateStoryInfo'>,
        @Body() body: unknown
    ): Promise<TEditStoryInfoDto> {
        const fields = jsonObjectBody(body);
        const passwordHash = await hashUpdatePassword(fields);
        const saved = await this.stories.exclusive(async (manager) => {
            const current = await this.stories.readVersioned(storyId, manager);
            if (!current) throw HttpError.noStory(storyId);
            // stale before invalid, as the version is what the change was based on
            if (fields.version !== current.version) throw new StoryVersionConflictError(storyId);
            const file = applyUpdateStoryBody(storyId, current.file, fields, passwordHash);
            const version = await this.stories.write(storyId, file, current.version, manager);
            if (file.email !== current.file.email && file.email !== '') {
                await this.storyGit.setAuthorEmail(storyId, file.email, manager);
            }
            return { file, version };
        });
        return buildStoryInfo(storyId, saved, this.folders.dir(storyId));
    }

    @ProtocolRoute('exportStory')
    async exportStory(@RouteParams() { storyId }: THandlerParams<'exportStory'>, @Res() res: Response): Promise<void> {
        const story = await this.stories.read(storyId);
        if (!story) throw HttpError.noStory(storyId);
        const zip = await this.folders.exportZip(storyId, story.mapSize);
        sendAttachment(res, `${storyId}.zip`, STORY_ZIP_CONTENT_TYPE, zip);
    }
}
