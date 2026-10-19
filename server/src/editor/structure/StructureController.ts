import { Body, Controller } from '@nestjs/common';
import type { TRouteBody, TRouteResponse, TStructureDto } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import { readStructure } from '../../project/readers/structure';
import type { SourceProject } from '../../project/SourceProject';
import { addLiteralValue, createLiteral, deleteLiteral, updateLiteral } from '../../project/writers/literals';
import { createType, deleteType, updateType } from '../../project/writers/structure';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

// engine types stay server-side: the writers still check names against them
const publicStructure = (sp: SourceProject): TStructureDto => {
    const structure = readStructure(sp);
    return { ...structure, types: structure.types.filter((type) => type.origin !== 'engine') };
};

@Controller()
export class StructureController {
    @ProtocolRoute('getStructure')
    getStructure(@StoryCtx() { sp }: TServerContext): Promise<TRouteResponse<'getStructure'>> {
        return sp.run(() => publicStructure(sp));
    }

    @ProtocolRoute('createType')
    createType(
        @StoryCtx() ctx: TServerContext,
        @Body() body: TRouteBody<'createType'>
    ): Promise<TRouteResponse<'createType'>> {
        return createType(ctx, body);
    }

    @ProtocolRoute('updateType')
    updateType(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { name }: THandlerParams<'updateType'>,
        @Body() body: TRouteBody<'updateType'>
    ): Promise<TRouteResponse<'updateType'>> {
        return updateType(ctx, name, body);
    }

    @ProtocolRoute('deleteType')
    deleteType(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { name }: THandlerParams<'deleteType'>,
        @Body() body: TRouteBody<'deleteType'>
    ): Promise<TRouteResponse<'deleteType'>> {
        return deleteType(ctx, name, body);
    }

    @ProtocolRoute('createLiteral')
    createLiteral(
        @StoryCtx() ctx: TServerContext,
        @Body() body: TRouteBody<'createLiteral'>
    ): Promise<TRouteResponse<'createLiteral'>> {
        return createLiteral(ctx, body);
    }

    @ProtocolRoute('updateLiteral')
    updateLiteral(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { name }: THandlerParams<'updateLiteral'>,
        @Body() body: TRouteBody<'updateLiteral'>
    ): Promise<TRouteResponse<'updateLiteral'>> {
        return updateLiteral(ctx, name, body);
    }

    @ProtocolRoute('addLiteralValue')
    addLiteralValue(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { name }: THandlerParams<'addLiteralValue'>,
        @Body() body: TRouteBody<'addLiteralValue'>
    ): Promise<TRouteResponse<'addLiteralValue'>> {
        return addLiteralValue(ctx, name, body);
    }

    @ProtocolRoute('deleteLiteral')
    deleteLiteral(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { name }: THandlerParams<'deleteLiteral'>,
        @Body() body: TRouteBody<'deleteLiteral'>
    ): Promise<TRouteResponse<'deleteLiteral'>> {
        return deleteLiteral(ctx, name, body);
    }
}
