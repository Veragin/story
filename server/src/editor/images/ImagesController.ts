import { Body, Controller, Req, Res } from '@nestjs/common';
import type { TRouteBody, TRouteResponse } from '@story/protocol';
import type { Request, Response } from 'express';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import { sendVersionedFile } from '../../common/versionedFile';
import { readImage, readImageFile, uploadImage } from '../../project/images';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

@Controller()
export class ImagesController {
    @ProtocolRoute('getImage')
    getImage(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { owner, id }: THandlerParams<'getImage'>
    ): Promise<TRouteResponse<'getImage'>> {
        return readImage(sp, owner, id);
    }

    @ProtocolRoute('getImageFile')
    async getImageFile(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { owner, id }: THandlerParams<'getImageFile'>,
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        const { bytes, version } = await readImageFile(sp, owner, id);
        sendVersionedFile(req, res, { bytes, version, contentType: 'image/png' });
    }

    @ProtocolRoute('uploadImage')
    uploadImage(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { owner, id }: THandlerParams<'uploadImage'>,
        @Body() body: TRouteBody<'uploadImage'>
    ): Promise<TRouteResponse<'uploadImage'>> {
        return uploadImage(ctx, owner, id, body);
    }
}
