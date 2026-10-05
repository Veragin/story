import type { TGlobalContext, TServerContext } from '../context';
import { registerAuthRoutes } from './auth';
import { registerCatalogRoutes } from './catalogs';
import { registerChapterRoutes } from './chapters';
import { registerEntityRoutes } from './entities';
import { registerEventRoutes } from './events';
import { registerHealthRoutes } from './health';
import { registerImageRoutes } from './images';
import { registerLayoutRoutes } from './layouts';
import { registerMapRoutes } from './maps';
import { registerPassageRoutes } from './passages';
import { registerProjectRoutes } from './project';
import { registerSourceRoutes } from './source';
import { registerStoryInfoRoutes } from './storyInfo';
import { registerStoryRoutes } from './stories';
import { registerStructureRoutes } from './structure';
import { registerTriggerRoutes } from './triggers';

export const registerRoutes = (ctx: TServerContext) => {
    registerEventRoutes(ctx);
    registerProjectRoutes(ctx);
    registerStoryInfoRoutes(ctx);
    registerChapterRoutes(ctx);
    registerPassageRoutes(ctx);
    registerTriggerRoutes(ctx);
    registerEntityRoutes(ctx);
    registerStructureRoutes(ctx);
    registerCatalogRoutes(ctx);
    registerImageRoutes(ctx);
    registerMapRoutes(ctx);
    registerLayoutRoutes(ctx);
    registerSourceRoutes(ctx);
};

export const registerGlobalRoutes = (ctx: TGlobalContext) => {
    registerHealthRoutes(ctx);
    registerStoryRoutes(ctx);
    registerAuthRoutes(ctx);
};
