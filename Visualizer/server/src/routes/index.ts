import type { TGlobalContext, TServerContext } from '../context';
import { registerAuthRoutes } from './auth';
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
import { registerTriggerRoutes } from './triggers';

/**
 * Register every `STORY_ROUTES` handler on one story's router. `StoryContexts` calls it for each
 * story it loads, and asserts afterwards that none is missing.
 */
export const registerRoutes = (ctx: TServerContext) => {
    registerEventRoutes(ctx);
    registerProjectRoutes(ctx);
    registerStoryInfoRoutes(ctx);
    registerChapterRoutes(ctx);
    registerPassageRoutes(ctx);
    registerTriggerRoutes(ctx);
    registerEntityRoutes(ctx);
    registerImageRoutes(ctx);
    registerMapRoutes(ctx);
    registerLayoutRoutes(ctx);
    registerSourceRoutes(ctx);
};

/** Register every `GLOBAL_ROUTES` handler on the app's router. `app.ts` asserts that none is missing. */
export const registerGlobalRoutes = (ctx: TGlobalContext) => {
    registerHealthRoutes(ctx);
    registerStoryRoutes(ctx);
    registerAuthRoutes(ctx);
};
