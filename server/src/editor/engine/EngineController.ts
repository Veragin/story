import { Body, Controller } from '@nestjs/common';
import type { TRouteBody, TRouteResponse } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import { readEngineSection } from '../../project/readers/engine';
import { updateEngineSection } from '../../project/writers/engine';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

@Controller()
export class EngineController {
    @ProtocolRoute('getEngineSection')
    getEngineSection(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { section }: THandlerParams<'getEngineSection'>
    ): Promise<TRouteResponse<'getEngineSection'>> {
        return sp.run(() => readEngineSection(sp, section));
    }

    @ProtocolRoute('updateEngineSection')
    updateEngineSection(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { section }: THandlerParams<'updateEngineSection'>,
        @Body() body: TRouteBody<'updateEngineSection'>
    ): Promise<TRouteResponse<'updateEngineSection'>> {
        return updateEngineSection(ctx, section, body);
    }
}
