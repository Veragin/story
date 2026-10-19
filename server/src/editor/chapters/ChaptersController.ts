import { Body, Controller } from '@nestjs/common';
import type { TRouteBody, TRouteResponse } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import { readChapter } from '../../project/readers/chapters';
import {
    addChapterCharacter,
    createChapter,
    deleteChapter,
    removeChapterCharacter,
    updateChapter,
} from '../../project/writers/chapters';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

@Controller()
export class ChaptersController {
    @ProtocolRoute('createChapter')
    createChapter(
        @StoryCtx() ctx: TServerContext,
        @Body() body: TRouteBody<'createChapter'>
    ): Promise<TRouteResponse<'createChapter'>> {
        return createChapter(ctx, body);
    }

    @ProtocolRoute('getChapter')
    getChapter(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { chapterId }: THandlerParams<'getChapter'>
    ): Promise<TRouteResponse<'getChapter'>> {
        return sp.run(() => readChapter(sp, chapterId));
    }

    @ProtocolRoute('updateChapter')
    updateChapter(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { chapterId }: THandlerParams<'updateChapter'>,
        @Body() body: TRouteBody<'updateChapter'>
    ): Promise<TRouteResponse<'updateChapter'>> {
        return updateChapter(ctx, chapterId, body);
    }

    @ProtocolRoute('deleteChapter')
    deleteChapter(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { chapterId }: THandlerParams<'deleteChapter'>,
        @Body() body: TRouteBody<'deleteChapter'>
    ): Promise<TRouteResponse<'deleteChapter'>> {
        return deleteChapter(ctx, chapterId, body);
    }

    @ProtocolRoute('addChapterCharacter')
    addChapterCharacter(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { chapterId }: THandlerParams<'addChapterCharacter'>,
        @Body() body: TRouteBody<'addChapterCharacter'>
    ): Promise<TRouteResponse<'addChapterCharacter'>> {
        return addChapterCharacter(ctx, chapterId, body);
    }

    @ProtocolRoute('removeChapterCharacter')
    removeChapterCharacter(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { chapterId, characterId }: THandlerParams<'removeChapterCharacter'>,
        @Body() body: TRouteBody<'removeChapterCharacter'>
    ): Promise<TRouteResponse<'removeChapterCharacter'>> {
        return removeChapterCharacter(ctx, chapterId, characterId, body);
    }
}
