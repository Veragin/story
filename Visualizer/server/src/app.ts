import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
    GLOBAL_ROUTES,
    splitStoryPath,
    STORY_ROUTES,
    matchRoute,
    type TGlobalRouteName,
} from '@story/visualizer-protocol';
import { cookieSecureFromEnv } from './auth/cookie';
import { allowedOriginsFromEnv, assertSafeMutation } from './auth/csrf';
import { LoginLimiter, trustProxyFromEnv } from './auth/LoginLimiter';
import { SessionStore } from './auth/SessionStore';
import type { TGlobalContext, TServerContext } from './context';
import { HttpError } from './http/HttpError';
import { Router, sendError } from './http/router';
import { registerGlobalRoutes } from './routes';
import { sessionAccessCheck, type TStoryAccessCheck } from './stories/access';
import { StoryContexts } from './stories/StoryContexts';
import { StoryStore } from './stories/StoryStore';

export type TAppOptions = {
    storiesRoot?: string;
    watch?: boolean;
    batchMs?: number;
    idleMs?: number;
    checkAccess?: TStoryAccessCheck;
    sessions?: SessionStore;
    loginLimiter?: LoginLimiter;
    trustProxy?: boolean;
    allowedOrigins?: readonly string[];
    cookieSecure?: boolean;
};

const endAtExpiry = (res: ServerResponse, expiresAt: number) => {
    // setTimeout overflows past ~24.8 days; grants last 24 h
    const timer = setTimeout(() => res.end(), Math.min(Math.max(0, expiresAt - Date.now()), 2 ** 31 - 1));
    timer.unref();
    res.on('close', () => clearTimeout(timer));
};

export type TApp = TGlobalContext & {
    server: Server;
    contexts: StoryContexts;
    story(storyId: string): Promise<TServerContext>;
    listen(port: number, host?: string): Promise<number>;
    close(): Promise<void>;
};

export const createApp = async ({
    storiesRoot,
    watch = true,
    batchMs,
    idleMs,
    checkAccess,
    sessions = new SessionStore(),
    loginLimiter = new LoginLimiter(),
    allowedOrigins = allowedOriginsFromEnv(),
    cookieSecure = cookieSecureFromEnv(),
    trustProxy = trustProxyFromEnv(),
}: TAppOptions = {}): Promise<TApp> => {
    const stories = storiesRoot === undefined ? StoryStore.fromEnv() : new StoryStore(storiesRoot);
    // fail at startup, not on the first request, when STORIES_ROOT points nowhere
    if (!(await stat(stories.root).catch(() => null))?.isDirectory()) {
        throw new Error(`STORIES_ROOT is not a directory: ${stories.root}`);
    }
    const router = new Router<TGlobalRouteName>(GLOBAL_ROUTES);
    const gctx: TGlobalContext = { router, stories, watch, sessions, loginLimiter, cookieSecure, trustProxy };
    const access = checkAccess ?? sessionAccessCheck({ sessions, stories });
    const origins = new Set(allowedOrigins);
    registerGlobalRoutes(gctx);
    router.assertComplete();
    const contexts = new StoryContexts({ stories, watch, batchMs, idleMs });

    const dispatch = async (req: IncomingMessage, res: ServerResponse) => {
        try {
            const method = req.method ?? 'GET';
            const { pathname } = new URL(req.url ?? '/', 'http://localhost');
            // global first: `login` / `getStoryAccess` live under /api/stories/ but need no grant
            const global = router.match(method, pathname);
            const scoped = global ? null : splitStoryPath(pathname);
            if (!scoped) {
                if (global) assertSafeMutation(req, origins, global.route);
                await router.dispatch(req, res, pathname);
                return;
            }
            const { storyId, rest } = scoped;
            const route = matchRoute(STORY_ROUTES, method, rest)?.route ?? null;
            if (route) assertSafeMutation(req, origins, route);
            if (!(await stories.exists(storyId))) {
                throw HttpError.noStory(storyId);
            }
            // before `acquire`, so a refused request never loads the story
            const grant = await access({ req, storyId, route });
            const lease = await contexts.acquire(storyId);
            try {
                await lease.ctx.router.dispatch(req, res, rest);
            } finally {
                // an open `/events` stream keeps the story loaded as a bus listener
                lease.release();
            }
            if (grant && !res.writableEnded) endAtExpiry(res, grant.expiresAt);
        } catch (e) {
            sendError(res, e);
        }
    };

    const server = createServer((req, res) => void dispatch(req, res));

    return {
        ...gctx,
        server,
        contexts,
        story: (storyId) => contexts.get(storyId),
        listen: (port, host = '0.0.0.0') =>
            new Promise<number>((resolve, reject) => {
                server.once('error', reject);
                server.listen(port, host, () => {
                    const address = server.address();
                    resolve(typeof address === 'object' && address ? address.port : port);
                });
            }),
        close: async () => {
            sessions.close();
            loginLimiter.close();
            await contexts.close();
            server.closeAllConnections();
            await new Promise<void>((resolve) => (server.listening ? server.close(() => resolve()) : resolve()));
        },
    };
};
