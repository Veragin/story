import { Body, Controller, Inject, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { TStoryDto, TStoryListItemDto } from '@story/protocol';
import type { Request, Response } from 'express';
import { AUTH_OPTIONS, type TAuthOptions } from '../auth/authOptions';
import { readSessionToken, sessionCookie } from '../auth/cookie';
import { SessionService } from '../auth/SessionService';
import { jsonObjectBody } from '../common/body';
import { HttpError } from '../common/HttpError';
import { ProtocolRoute } from '../common/ProtocolRoute';
import { toStoryDto, type TStoryFile } from './storyFile';
import { StoryFolders } from './StoryFolders';
import { parseCreateStoryBody, parseImportStoryBody, zipMapSize } from './storyInput';
import { StoryRepository } from './StoryRepository';
import { StoryZipInterceptor } from './StoryZipInterceptor';
import { unzipStory } from './zip';

type TUploadedZip = { buffer: Buffer };

@Controller()
export class StoriesController {
    constructor(
        private readonly stories: StoryRepository,
        private readonly folders: StoryFolders,
        private readonly sessions: SessionService,
        @Inject(AUTH_OPTIONS) private readonly options: TAuthOptions
    ) {}

    @ProtocolRoute('listStories')
    async listStories(@Req() req: Request): Promise<TStoryListItemDto[]> {
        const unlocked = new Set(await this.sessions.storyIds(readSessionToken(req)));
        return (await this.stories.list()).map(({ id, file }) => ({
            ...toStoryDto(id, file),
            unlocked: unlocked.has(id),
        }));
    }

    @ProtocolRoute('createStory')
    async createStory(
        @Body() body: unknown,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<TStoryDto> {
        const file = await parseCreateStoryBody(jsonObjectBody(body));
        return this.welcome(await this.folders.create(file), file, req, res);
    }

    @ProtocolRoute('importStory')
    @UseInterceptors(StoryZipInterceptor)
    async importStory(
        @UploadedFile() zip: TUploadedZip | undefined,
        @Body() fields: unknown,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<TStoryDto> {
        if (!zip) throw HttpError.badRequest('Field "zip" must be the story zip file');
        const files = unzipStory(zip.buffer);
        const file = await parseImportStoryBody(fields, zipMapSize(files));
        return this.welcome(await this.folders.import(file, files), file, req, res);
    }

    // the author of a new story is logged in to it
    private async welcome(id: string, file: TStoryFile, req: Request, res: Response): Promise<TStoryDto> {
        const { token } = await this.sessions.grant(readSessionToken(req), id);
        res.setHeader('set-cookie', sessionCookie(token, this.options.cookieSecure));
        return toStoryDto(id, file);
    }
}
