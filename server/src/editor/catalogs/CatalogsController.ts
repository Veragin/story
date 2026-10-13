import { Body, Controller } from '@nestjs/common';
import type { TRouteBody, TRouteResponse } from '@story/protocol';
import { ProtocolRoute } from '../../common/ProtocolRoute';
import { RouteParams, type THandlerParams } from '../../common/RouteParams';
import { findCatalog, findCatalogEntry, listCatalog, readCatalogEntry } from '../../project/readers/catalogs';
import {
    catalogEntryDeleteReferences,
    createCatalogEntry,
    deleteCatalogEntry,
    updateCatalogEntry,
} from '../../project/writers/catalogs';
import type { TServerContext } from '../../storyContext/serverContext';
import { StoryCtx } from '../../storyContext/StoryCtx';

@Controller()
export class CatalogsController {
    @ProtocolRoute('listCatalogEntries')
    listCatalogEntries(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { name }: THandlerParams<'listCatalogEntries'>
    ): Promise<TRouteResponse<'listCatalogEntries'>> {
        return sp.run(() => listCatalog(sp, name));
    }

    @ProtocolRoute('createCatalogEntry')
    createCatalogEntry(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { name }: THandlerParams<'createCatalogEntry'>,
        @Body() body: TRouteBody<'createCatalogEntry'>
    ): Promise<TRouteResponse<'createCatalogEntry'>> {
        return createCatalogEntry(ctx, name, body);
    }

    @ProtocolRoute('getCatalogEntry')
    getCatalogEntry(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { name, id }: THandlerParams<'getCatalogEntry'>
    ): Promise<TRouteResponse<'getCatalogEntry'>> {
        return sp.run(() => readCatalogEntry(sp, findCatalogEntry(sp, findCatalog(sp, name), id)));
    }

    @ProtocolRoute('updateCatalogEntry')
    updateCatalogEntry(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { name, id }: THandlerParams<'updateCatalogEntry'>,
        @Body() body: TRouteBody<'updateCatalogEntry'>
    ): Promise<TRouteResponse<'updateCatalogEntry'>> {
        return updateCatalogEntry(ctx, name, id, body);
    }

    @ProtocolRoute('deleteCatalogEntry')
    deleteCatalogEntry(
        @StoryCtx() ctx: TServerContext,
        @RouteParams() { name, id }: THandlerParams<'deleteCatalogEntry'>,
        @Body() body: TRouteBody<'deleteCatalogEntry'>
    ): Promise<TRouteResponse<'deleteCatalogEntry'>> {
        return deleteCatalogEntry(ctx, name, id, body);
    }

    @ProtocolRoute('getCatalogEntryReferences')
    getCatalogEntryReferences(
        @StoryCtx() { sp }: TServerContext,
        @RouteParams() { name, id }: THandlerParams<'getCatalogEntryReferences'>
    ): Promise<TRouteResponse<'getCatalogEntryReferences'>> {
        return catalogEntryDeleteReferences(sp, name, id);
    }
}
