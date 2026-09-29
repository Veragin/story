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
    /** The folder holding one folder per story (default: `STORIES_ROOT`, else `<repo>/stories`). */
    storiesRoot?: string;
    /** Start a chokidar watcher behind each loaded story's `/events` (default true). */
    watch?: boolean;
    batchMs?: number;
    /** Unload a story after this long without use (default 30 min, see `StoryContexts`). */
    idleMs?: number;
    /**
     * Who may reach a story (default: `sessionAccessCheck`, a login grant in the session cookie).
     * Tests about something other than auth may pass `allowAllStoryAccess`. See `stories/access.ts`.
     */
    checkAccess?: TStoryAccessCheck;
    /** The login grants (default: a new in-memory store; tests pass one to control the TTL). */
    sessions?: SessionStore;
    loginLimiter?: LoginLimiter;
    /** Key the login limiter on `X-Forwarded-For`'s last hop (default: `TRUST_PROXY=1`). */
    trustProxy?: boolean;
    /** Origins a mutation may come from (default: `ALLOWED_ORIGINS`, see `auth/csrf.ts`). */
    allowedOrigins?: readonly string[];
    /** Mark the session cookie `Secure` (default: `COOKIE_SECURE=1`). */
    cookieSecure?: boolean;
};

/**
 * End a response that is still streaming (`/events`) when the grant that let it through expires.
 * The timer goes away with the response.
 */
const endAtExpiry = (res: ServerResponse, expiresAt: number) => {
    // setTimeout overflows past ~24.8 days; grants last 24 h
    const timer = setTimeout(() => res.end(), Math.min(Math.max(0, expiresAt - Date.now()), 2 ** 31 - 1));
    timer.unref();
    res.on('close', () => clearTimeout(timer));
};

export type TApp = TGlobalContext & {
    server: Server;
    contexts: StoryContexts;
    /** A story's context (its project, bus and router), loading it if needed. */
    story(storyId: string): Promise<TServerContext>;
    /** Start listening; resolves with the bound port (pass 0 for an ephemeral one in tests). */
    listen(port: number, host?: string): Promise<number>;
    close(): Promise<void>;
};

/**
 * Build the server without starting it: the global router, the story registry and the lazily
 * loaded story contexts. `index.ts` is the process entry; tests call this with a temp
 * `storiesRoot`.
 *
 * Every request goes through one dispatcher:
 *
 *  0. A mutation (not GET / HEAD) of a known route must pass the CSRF check (`auth/csrf.ts`): its
 *     content type and its `Origin`. (One that matches no route does nothing but answer 404.)
 *  1. A `GLOBAL_ROUTES` match goes to the global router. Global routes come first, so they may
 *     live under `/api/stories/…` too (`login`, `getStoryAccess`: the two story URLs that need no
 *     grant).
 *  2. `/api/stories/:storyId/<rest>`: 404 unless the story exists, then the access check
 *     (`checkAccess`: a login grant for the story, `stories/access.ts`), then the story is loaded
 *     and its own router answers `<rest>` against `STORY_ROUTES`. A response still open when the
 *     grant expires (the `/events` stream) is ended then; the client's next request gets `401`.
 *  3. Anything else: the global router's 404.
 */
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
    const missing = router.missing();
    if (missing.length > 0) {
        throw new Error(`Protocol routes without a handler: ${missing.join(', ')}`);
    }
    const contexts = new StoryContexts({ stories, watch, batchMs, idleMs });

    const dispatch = async (req: IncomingMessage, res: ServerResponse) => {
        try {
            const method = req.method ?? 'GET';
            const { pathname } = new URL(req.url ?? '/', 'http://localhost');
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
                throw HttpError.notFound(`No story "${storyId}"`);
            }
            // The grant check. Before `acquire`, so a refused request never loads the story.
            const grant = await access({ req, storyId, route });
            const lease = await contexts.acquire(storyId);
            try {
                await lease.ctx.router.dispatch(req, res, rest);
            } finally {
                // An `/events` stream outlives this: it keeps the story loaded as a bus listener.
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
