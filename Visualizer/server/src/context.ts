import type { TGlobalRouteName, TStoryRouteName } from '@story/visualizer-protocol';
import type { LoginLimiter } from './auth/LoginLimiter';
import type { SessionStore } from './auth/SessionStore';
import type { EventBus } from './events/EventBus';
import type { Router } from './http/router';
import type { ProjectRoot } from './project/ProjectRoot';
import type { StoryStore } from './stories/StoryStore';

/**
 * What every story-scoped `routes/<resource>.ts` gets: one story's project on disk, its change
 * bus and its router. Each loaded story has its own (`stories/StoryContexts.ts`), so a handler
 * that closes over `project` / `bus` can only ever touch its own story.
 */
export type TServerContext = {
    storyId: string;
    /** The story registry, for the story's own `story.json` (`GET/PUT /info`). */
    stories: StoryStore;
    project: ProjectRoot;
    bus: EventBus;
    router: Router<TStoryRouteName>;
    /** Whether the story's file watcher is running (off in some tests). */
    watching: () => boolean;
};

/** What the global routes (`GLOBAL_ROUTES`: health, the stories, auth) get. */
export type TGlobalContext = {
    router: Router<TGlobalRouteName>;
    stories: StoryStore;
    /** Whether loaded stories run a file watcher. */
    watch: boolean;
    /** Login grants (`auth/SessionStore.ts`). */
    sessions: SessionStore;
    /** Failed-login counter (`auth/LoginLimiter.ts`). */
    loginLimiter: LoginLimiter;
    /** Whether the login limiter keys on `X-Forwarded-For` (`TRUST_PROXY=1`, `auth/LoginLimiter.ts#clientAddress`). */
    trustProxy: boolean;
    /** Whether the session cookie gets `Secure` (`COOKIE_SECURE=1`). */
    cookieSecure: boolean;
};
