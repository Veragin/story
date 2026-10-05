import { STORY_ROUTES, type TStoryRouteName } from '@story/visualizer-protocol';
import type { FSWatcher } from 'chokidar';
import type { TServerContext } from '../context';
import { EventBus } from '../events/EventBus';
import { startWatcher } from '../events/watcher';
import { Router } from '../http/router';
import { migrateStructureLayout } from '../project/migrations/structureLayout';
import { ProjectRoot } from '../project/ProjectRoot';
import { SourceProject } from '../project/SourceProject';
import { registerRoutes } from '../routes';
import type { StoryStore } from './StoryStore';

export type TStoryContextsOptions = {
    stories: StoryStore;
    watch?: boolean;
    batchMs?: number;
    idleMs?: number;
    sweepMs?: number;
};

export type TStoryLease = { ctx: TServerContext; release: () => void };

type TEntry = {
    ready: Promise<TServerContext>;
    ctx: TServerContext | null;
    close: () => Promise<void>;
    active: number;
    lastUsed: number;
};

type TLoaded = { watcher: FSWatcher | null; bus: EventBus | null };

const DEFAULT_IDLE_MS = 30 * 60_000;

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

    loadedIds(): string[] {
        return [...this.entries.keys()];
    }

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

    async get(storyId: string): Promise<TServerContext> {
        const lease = await this.acquire(storyId);
        lease.release();
        return lease.ctx;
    }

    async evictIdle(now = Date.now()): Promise<string[]> {
        const idle = [...this.entries].filter(
            ([, e]) =>
                e.ctx !== null && e.active === 0 && e.ctx.bus.listenerCount === 0 && now - e.lastUsed >= this.idleMs
        );
        await Promise.all(idle.map(([id]) => this.evict(id)));
        return idle.map(([id]) => id);
    }

    async evict(storyId: string): Promise<void> {
        const entry = this.entries.get(storyId);
        if (!entry) return;
        this.entries.delete(storyId);
        await entry.close();
    }

    async close(): Promise<void> {
        this.closed = true;
        clearInterval(this.sweepTimer);
        await Promise.all([...this.entries.keys()].map((id) => this.evict(id)));
    }

    private entry(storyId: string): TEntry {
        const existing = this.entries.get(storyId);
        if (existing) return existing;

        const loaded: TLoaded = { watcher: null, bus: null };
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
        void this.settle(storyId, entry);
        this.entries.set(storyId, entry);
        return entry;
    }

    private async settle(storyId: string, entry: TEntry): Promise<void> {
        try {
            entry.ctx = await entry.ready;
        } catch {
            // a failed load is not cached: the next request tries again
            if (this.entries.get(storyId) === entry) this.entries.delete(storyId);
        }
    }

    private async load(storyId: string, loaded: TLoaded): Promise<TServerContext> {
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
        const sp = SourceProject.for(project);
        sp.onFirstRun(() => migrateStructureLayout(sp, bus));
        registerRoutes(ctx);
        router.assertComplete();
        if (this.watch) loaded.watcher = await startWatcher(bus);
        return ctx;
    }
}
