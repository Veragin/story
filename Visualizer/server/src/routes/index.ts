import type { TServerContext } from '../context';
import { registerChapterRoutes } from './chapters';
import { registerEntityRoutes } from './entities';
import { registerEventRoutes } from './events';
import { registerHealthRoutes } from './health';
import { registerLayoutRoutes } from './layouts';
import { registerMapRoutes } from './maps';
import { registerOpenRoutes } from './open';
import { registerPassageRoutes } from './passages';
import { registerProjectRoutes } from './project';
import { registerTriggerRoutes } from './triggers';

/** Register every protocol route. `app.ts` asserts afterwards that none is missing. */
export const registerRoutes = (ctx: TServerContext) => {
    registerHealthRoutes(ctx);
    registerEventRoutes(ctx);
    registerProjectRoutes(ctx);
    registerChapterRoutes(ctx);
    registerPassageRoutes(ctx);
    registerTriggerRoutes(ctx);
    registerEntityRoutes(ctx);
    registerMapRoutes(ctx);
    registerLayoutRoutes(ctx);
    // after chapters/passages: replaces their `open*` stubs
    registerOpenRoutes(ctx);
};
