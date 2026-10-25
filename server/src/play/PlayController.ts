import { Controller, Inject, Req, Res } from '@nestjs/common';
import { STORY_ZIP_CONTENT_TYPE, type TPlayManifestDto } from '@story/protocol';
import type { Request, Response } from 'express';
import { sendAttachment } from '../common/attachment';
import { HttpError } from '../common/HttpError';
import { ProtocolRoute } from '../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../common/RouteParams';
import { sendVersionedFile } from '../common/versionedFile';
import { StoryRepository } from '../database/repositories/StoryRepository';
import type { TServerContext } from '../storyContext/serverContext';
import { StoryCtx } from '../storyContext/StoryCtx';
import { buildPlayManifest, readPlayFile } from './playFiles';
import { STANDALONE_PLAYER_DIR, zipPlayable } from './standalonePlayer';

@Controller()
export class PlayController {
    constructor(
        private readonly stories: StoryRepository,
        @Inject(STANDALONE_PLAYER_DIR) private readonly standalonePlayerDir: string
    ) {}

    private async manifest(storyId: string, storyDir: string): Promise<TPlayManifestDto> {
        const current = await this.stories.readVersioned(storyId);
        if (!current) throw HttpError.noStory(storyId);
        return buildPlayManifest(storyId, current, storyDir);
    }

    @ProtocolRoute('getPlayManifest')
    getPlayManifest(
        @StoryCtx() { project }: TServerContext,
        @RouteParams() { storyId }: THandlerParams<'getPlayManifest'>
    ): Promise<TPlayManifestDto> {
        return this.manifest(storyId, project.root);
    }

    @ProtocolRoute('getPlayFile')
    async getPlayFile(
        @StoryCtx() { project }: TServerContext,
        @RouteParams() { file }: THandlerParams<'getPlayFile'>,
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        sendVersionedFile(req, res, await readPlayFile(project.root, file));
    }

    @ProtocolRoute('exportPlayable')
    async exportPlayable(
        @StoryCtx() { project }: TServerContext,
        @RouteParams() { storyId }: THandlerParams<'exportPlayable'>,
        @Res() res: Response
    ): Promise<void> {
        const manifest = await this.manifest(storyId, project.root);
        const zip = await zipPlayable(project.root, manifest, this.standalonePlayerDir);
        sendAttachment(res, `${storyId}-web.zip`, STORY_ZIP_CONTENT_TYPE, zip);
    }
}
