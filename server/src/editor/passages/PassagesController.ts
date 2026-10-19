import { Body, Controller } from '@nestjs/common';
import type { TRouteBody, TRouteResponse } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import { readChapterPassages, readPassage } from '../../project/readers/passages';
import { createPassage, deletePassage, updatePassage } from '../../project/writers/passages';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

@Controller()
export class PassagesController {
    @ProtocolRoute('listChapterPassages')
    listChapterPassages(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { chapterId }: THandlerParams<'listChapterPassages'>
    ): Promise<TRouteResponse<'listChapterPassages'>> {
        return sp.run(() => readChapterPassages(sp, chapterId));
    }

    @ProtocolRoute('createPassage')
    createPassage(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { chapterId }: THandlerParams<'createPassage'>,
        @Body() body: TRouteBody<'createPassage'>
    ): Promise<TRouteResponse<'createPassage'>> {
        return createPassage(ctx, chapterId, body);
    }

    @ProtocolRoute('getPassage')
    getPassage(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { passageId }: THandlerParams<'getPassage'>
    ): Promise<TRouteResponse<'getPassage'>> {
        return sp.run(() => readPassage(sp, passageId));
    }

    @ProtocolRoute('updatePassage')
    updatePassage(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { passageId }: THandlerParams<'updatePassage'>,
        @Body() body: TRouteBody<'updatePassage'>
    ): Promise<TRouteResponse<'updatePassage'>> {
        return updatePassage(ctx, passageId, body);
    }

    @ProtocolRoute('deletePassage')
    deletePassage(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { passageId }: THandlerParams<'deletePassage'>,
        @Body() body: TRouteBody<'deletePassage'>
    ): Promise<TRouteResponse<'deletePassage'>> {
        return deletePassage(ctx, passageId, body);
    }
}
