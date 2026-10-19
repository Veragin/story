import { Body, Controller } from '@nestjs/common';
import type { TRouteBody, TRouteResponse } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import { readTrigger } from '../../project/readers/triggers';
import { createTrigger, deleteTrigger, updateTrigger } from '../../project/writers/triggers';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

@Controller()
export class TriggersController {
    @ProtocolRoute('createTrigger')
    createTrigger(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { chapterId }: THandlerParams<'createTrigger'>,
        @Body() body: TRouteBody<'createTrigger'>
    ): Promise<TRouteResponse<'createTrigger'>> {
        return createTrigger(ctx, chapterId, body);
    }

    @ProtocolRoute('getTrigger')
    getTrigger(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { triggerId }: THandlerParams<'getTrigger'>
    ): Promise<TRouteResponse<'getTrigger'>> {
        return sp.run(() => readTrigger(sp, triggerId));
    }

    @ProtocolRoute('updateTrigger')
    updateTrigger(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { triggerId }: THandlerParams<'updateTrigger'>,
        @Body() body: TRouteBody<'updateTrigger'>
    ): Promise<TRouteResponse<'updateTrigger'>> {
        return updateTrigger(ctx, triggerId, body);
    }

    @ProtocolRoute('deleteTrigger')
    deleteTrigger(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { triggerId }: THandlerParams<'deleteTrigger'>,
        @Body() body: TRouteBody<'deleteTrigger'>
    ): Promise<TRouteResponse<'deleteTrigger'>> {
        return deleteTrigger(ctx, triggerId, body);
    }
}
