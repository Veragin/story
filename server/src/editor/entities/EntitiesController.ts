import { Body, Controller } from '@nestjs/common';
import type { TRouteBody, TRouteResponse } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import { listEntities, readEntity } from '../../project/readers/entities';
import { createEntity, deleteEntity, entityDeleteReferences, updateEntity } from '../../project/writers/entities';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

@Controller()
export class EntitiesController {
    @ProtocolRoute('listEntities')
    listEntities(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { kind }: THandlerParams<'listEntities'>
    ): Promise<TRouteResponse<'listEntities'>> {
        return sp.run(() => ({ kind, entities: listEntities(sp, kind) }));
    }

    @ProtocolRoute('createEntity')
    createEntity(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { kind }: THandlerParams<'createEntity'>,
        @Body() body: TRouteBody<'createEntity'>
    ): Promise<TRouteResponse<'createEntity'>> {
        return createEntity(ctx, kind, body);
    }

    @ProtocolRoute('getEntity')
    getEntity(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { kind, id }: THandlerParams<'getEntity'>
    ): Promise<TRouteResponse<'getEntity'>> {
        return sp.run(() => readEntity(sp, kind, id));
    }

    @ProtocolRoute('updateEntity')
    updateEntity(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { kind, id }: THandlerParams<'updateEntity'>,
        @Body() body: TRouteBody<'updateEntity'>
    ): Promise<TRouteResponse<'updateEntity'>> {
        return updateEntity(ctx, kind, id, body);
    }

    @ProtocolRoute('deleteEntity')
    deleteEntity(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { kind, id }: THandlerParams<'deleteEntity'>,
        @Body() body: TRouteBody<'deleteEntity'>
    ): Promise<TRouteResponse<'deleteEntity'>> {
        return deleteEntity(ctx, kind, id, body);
    }

    @ProtocolRoute('getEntityReferences')
    getEntityReferences(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { kind, id }: THandlerParams<'getEntityReferences'>
    ): Promise<TRouteResponse<'getEntityReferences'>> {
        return entityDeleteReferences(sp, kind, id);
    }
}
