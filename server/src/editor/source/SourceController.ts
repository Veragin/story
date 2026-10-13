import { Body, Controller } from '@nestjs/common';
import type { TRouteBody, TRouteResponse } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import { readSource, updateSource } from '../../project/writers/source';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

@Controller()
export class SourceController {
    @ProtocolRoute('getSource')
    getSource(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { owner, id }: THandlerParams<'getSource'>
    ): Promise<TRouteResponse<'getSource'>> {
        return readSource(sp, owner, id);
    }

    @ProtocolRoute('updateSource')
    updateSource(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { owner, id }: THandlerParams<'updateSource'>,
        @Body() body: TRouteBody<'updateSource'>
    ): Promise<TRouteResponse<'updateSource'>> {
        return updateSource(ctx, owner, id, body);
    }
}
