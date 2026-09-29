import { STORY_ROUTES, type TStoryRouteName } from '@story/visualizer-protocol';
import type { FSWatcher } from 'chokidar';
import type { TServerContext } from '../context';
import { EventBus } from '../events/EventBus';
import { startWatcher } from '../events/watcher';
import { Router } from '../http/router';
import { ProjectRoot } from '../project/ProjectRoot';
import { registerRoutes } from '../routes';
import type { StoryStore } from './StoryStore';

export type TStoryContextsOptions = {
    stories: StoryStore;
    /** Start a chokidar watcher for each loaded story (default true). */
    watch?: boolean;
    /** The bus's batch window, passed through (tests shorten it). */
    batchMs?: number;
    /** Unload a story after this long without use (default 30 min). */
    idleMs?: number;
    /** How often to look for idle stories (default: `idleMs`, at most once a minute). */
    sweepMs?: number;
};

/** A story checked out for one request. Call `release` when the request is done. */
export type TStoryLease = { ctx: TServerContext; release: () => void };

type TEntry = {
    ready: Promise<TServerContext>;
    /** Set once `ready` resolves; eviction only looks at loaded entries. */
    ctx: TServerContext | null;
    close: () => Promise<void>;
    /** Requests in flight. */
    active: number;
    lastUsed: number;
};

const DEFAULT_IDLE_MS = 30 * 60_000;

/**
 * The loaded stories: a lazy cache `storyId → TServerContext`. A story is loaded on its first
 * request: its `ProjectRoot`, `EventBus`, file watcher and a `Router` over `STORY_ROUTES` filled by
 * `registerRoutes(ctx)` (which also creates its `SourceProject`, `SourceProject.for(project)`).
 * Route handlers close over that context, so they are per story without knowing it.
 *
 * A story is **idle** when no request is in flight, no one listens on its bus (an open `/events`
 * stream is a listener) and nothing used it for `idleMs`. Idle stories are unloaded: the watcher
 * and bus are closed and the context dropped, which lets the `SourceProject` (a ts-morph project,
 * tens of MB) be collected. The next request loads the story again.
 *
 * Callers must check that the story exists (`StoryStore.exists`) first; this class trusts the id.
 */
export class StoryContexts {
    private readonly stories: StoryStore;
    private readonly watch: boolean;
    private readonly batchMs?: number;
    private readonly idleMs: number;
    private readonly entries = new Map<string, TEntry>();
    private readonly sweepTimer: NodeJS.Timeout;
    private closed = false;

    constructor({ stories, watch = true, batchMs, idleMs = DEFAULT_IDLE_MS, sweepMs }: TStoryContextsOptions) {
        this.stories = stories;
        this.watch = watch;
        this.batchMs = batchMs;
        this.idleMs = idleMs;
        this.sweepTimer = setInterval(() => void this.evictIdle(), sweepMs ?? Math.min(idleMs, 60_000));
        this.sweepTimer.unref();
    }

    /** Ids of the stories loaded (or loading) right now. */
    loadedIds(): string[] {
        return [...this.entries.keys()];
    }

    /**
     * Check a story out for one request, loading it if needed. The story is not evicted until the
     * lease is released.
     */
    async acquire(storyId: string): Promise<TStoryLease> {
        if (this.closed) throw new Error('StoryContexts is closed');
        const entry = this.entry(storyId);
        entry.active++;
        entry.lastUsed = Date.now();
        let ctx: TServerContext;
        try {
            ctx = await entry.ready;
        } catch (e) {
            entry.active--;
            throw e;
        }
        let released = false;
        return {
            ctx,
            release: () => {
                if (released) return;
                released = true;
                entry.active--;
                entry.lastUsed = Date.now();
            },
        };
    }

    /** The context of a story, loading it if needed (tests, and code that holds no request). */
    async get(storyId: string): Promise<TServerContext> {
        const lease = await this.acquire(storyId);
        lease.release();
        return lease.ctx;
    }

    /** Unload every idle story (see the class comment). Returns the ids unloaded. */
    async evictIdle(now = Date.now()): Promise<string[]> {
        const idle = [...this.entries].filter(
            ([, e]) =>
                e.ctx !== null && e.active === 0 && e.ctx.bus.listenerCount === 0 && now - e.lastUsed >= this.idleMs
        );
        await Promise.all(idle.map(([id]) => this.evict(id)));
        return idle.map(([id]) => id);
    }

    /** Unload one story now, whatever it is doing (open streams are cut off). */
    async evict(storyId: string): Promise<void> {
        const entry = this.entries.get(storyId);
        if (!entry) return;
        this.entries.delete(storyId);
        await entry.close();
    }

    /** Unload everything and stop the sweep timer. */
    async close(): Promise<void> {
        this.closed = true;
        clearInterval(this.sweepTimer);
        await Promise.all([...this.entries.keys()].map((id) => this.evict(id)));
    }

    private entry(storyId: string): TEntry {
        const existing = this.entries.get(storyId);
        if (existing) return existing;

        const loaded: { watcher: FSWatcher | null; bus: EventBus | null } = { watcher: null, bus: null };
        const ready = this.load(storyId, loaded);
        const entry: TEntry = {
            ready,
            ctx: null,
            active: 0,
            lastUsed: Date.now(),
            close: async () => {
                // wait for a load in progress, so its watcher is not left running
                await ready.catch(() => undefined);
                await loaded.watcher?.close();
                loaded.watcher = null;
                await loaded.bus?.close();
            },
        };
        ready.then(
            (ctx) => {
                entry.ctx = ctx;
            },
            () => {
                // a failed load is not cached: the next request tries again
                if (this.entries.get(storyId) === entry) this.entries.delete(storyId);
            }
        );
        this.entries.set(storyId, entry);
        return entry;
    }

    /** Build a story's context. `loaded` receives the watcher and bus as they are made, for `close`. */
    private async load(
        storyId: string,
        loaded: { watcher: FSWatcher | null; bus: EventBus | null }
    ): Promise<TServerContext> {
        const project = new ProjectRoot(this.stories.dir(storyId), storyId);
        const bus = new EventBus({ project, batchMs: this.batchMs });
        loaded.bus = bus;
        const router = new Router<TStoryRouteName>(STORY_ROUTES);
        const ctx: TServerContext = {
            storyId,
            stories: this.stories,
            project,
            bus,
            router,
            watching: () => loaded.watcher !== null,
        };
        registerRoutes(ctx);
        const missing = router.missing();
        if (missing.length > 0) {
            throw new Error(`Protocol routes without a handler: ${missing.join(', ')}`);
        }
        if (this.watch) loaded.watcher = await startWatcher(bus);
        return ctx;
    }
}
