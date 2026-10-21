import { Controller, Req, Res } from '@nestjs/common';
import type { TPlayManifestDto } from '@story/protocol';
import type { Request, Response } from 'express';
import { HttpError } from '../common/HttpError';
import { ProtocolRoute } from '../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../common/RouteParams';
import { sendVersionedFile } from '../common/versionedFile';
import { StoryRepository } from '../database/repositories/StoryRepository';
import type { TServerContext } from '../storyContext/serverContext';
import { StoryCtx } from '../storyContext/StoryCtx';
import { hasLandingImage, listPlayFiles, readPlayFile } from './playFiles';

@Controller()
export class PlayController {
    constructor(private readonly stories: StoryRepository) {}

    @ProtocolRoute('getPlayManifest')
    async getPlayManifest(
        @StoryCtx() { project }: TServerContext,
        @RouteParams() { storyId }: THandlerParams<'getPlayManifest'>
    ): Promise<TPlayManifestDto> {
        const current = await this.stories.readVersioned(storyId);
        if (!current) throw HttpError.noStory(storyId);
        const { name, author, description } = current.file;
        return {
            id: storyId,
            name,
            author,
            description,
            version: current.version,
            hasLandingImage: await hasLandingImage(project.root),
            files: await listPlayFiles(project.root),
        };
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
}
