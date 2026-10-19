import { Body, Controller } from '@nestjs/common';
import type { TChapterLayoutDto, TTimelineLayoutDto } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import {
    readChapterLayout,
    readTimelineLayout,
    updateChapterLayout,
    updateTimelineLayout,
} from '../../json/layoutStore';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

@Controller()
export class LayoutsController {
    @ProtocolRoute('getTimelineLayout')
    getTimelineLayout(@StoryCtx() { project }: TServerContext): Promise<TTimelineLayoutDto> {
        return readTimelineLayout(project);
    }

    @ProtocolRoute('updateTimelineLayout')
    updateTimelineLayout(@StoryCtx() ctx: TServerContext, @Body() body: unknown): Promise<TTimelineLayoutDto> {
        return updateTimelineLayout(ctx, body);
    }

    @ProtocolRoute('getChapterLayout')
    getChapterLayout(
        @StoryCtx() { project }: TServerContext,
        @RouteParams() { chapterId }: THandlerParams<'getChapterLayout'>
    ): Promise<TChapterLayoutDto> {
        return readChapterLayout(project, chapterId);
    }

    @ProtocolRoute('updateChapterLayout')
    updateChapterLayout(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { chapterId }: THandlerParams<'updateChapterLayout'>,
        @Body() body: unknown
    ): Promise<TChapterLayoutDto> {
        return updateChapterLayout(ctx, chapterId, body);
    }
}
