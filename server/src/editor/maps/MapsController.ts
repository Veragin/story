import { Body, Controller } from '@nestjs/common';
import type { TMapDto, TOkDto } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import { deleteMap, readMap, updateMap } from '../../json/mapStore';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';
import { StoryRepository } from '../../database/repositories/StoryRepository';

@Controller()
export class MapsController {
    constructor(private readonly stories: StoryRepository) {}

    @ProtocolRoute('getMap')
    async getMap(
        @StoryCtx() { project }: TServerContext,
        @RouteParams() { storyId, mapId }: THandlerParams<'getMap'>
    ): Promise<TMapDto> {
        return readMap(project, mapId, (await this.stories.read(storyId))?.mapSize);
    }

    @ProtocolRoute('updateMap')
    updateMap(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { mapId }: THandlerParams<'updateMap'>,
        @Body() body: unknown
    ): Promise<TMapDto> {
        return updateMap(ctx, mapId, body);
    }

    @ProtocolRoute('deleteMap')
    deleteMap(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { mapId }: THandlerParams<'deleteMap'>,
        @Body() body: unknown
    ): Promise<TOkDto> {
        return deleteMap(ctx, mapId, body);
    }
}
