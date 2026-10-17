import { mkdir } from 'node:fs/promises';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { FSWatcher } from 'chokidar';
import { EventBus } from '../events/EventBus';
import { startWatcher } from '../events/watcher';
import { migrateStructureLayout } from '../project/migrations/structureLayout';
import { ProjectRoot } from '../project/ProjectRoot';
import { SourceProject } from '../project/SourceProject';
import { StoryFolders } from '../stories/StoryFolders';
import { migrateStoryTsconfig } from '../stories/storyTsconfig';
import type { TServerContext } from './serverContext';
import { STORY_CONTEXTS_OPTIONS, type TStoryContextsOptions } from './storyContextsOptions';

export type TStoryLease = { ctx: TServerContext; release: () => void };

type TEntry = {
    ready: Promise<TServerContext>;
    loaded: TLoaded;
    ctx: TServerContext | null;
    close: () => Promise<void>;
    active: number;
    lastUsed: number;
};

type TLoaded = { watcher: FSWatcher | null; bus: EventBus | null };

@Injectable()
export class StoryContexts implements OnApplicationShutdown {
    private readonly entries = new Map<string, TEntry>();
    private readonly sweepTimer: NodeJS.Timeout;
    private closed = false;

    constructor(
        @Inject(STORY_CONTEXTS_OPTIONS) private readonly options: TStoryContextsOptions,
        private readonly folders: StoryFolders
    ) {
        const { idleMs, sweepMs } = options;
        this.sweepTimer = setInterval(() => void this.evictIdle(), sweepMs ?? Math.min(idleMs, 60_000));
        this.sweepTimer.unref();
    }

    onApplicationShutdown(): Promise<void> {
        return this.close();
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

    activeLeases(storyId: string): number {
        return this.entries.get(storyId)?.active ?? 0;
    }

    // after a bulk rewrite of the files (git): reruns the load-time migrations and rewatches the folder, which may be
    // a new one. New requests wait for it; requests holding the context, the caller's included, are not waited for
    async reload(storyId: string): Promise<void> {
        const entry = this.entries.get(storyId);
        if (!entry) return;
        const previous = entry.ready;
        const refreshed = (async () => this.refresh(await previous, entry.loaded))();
        entry.ready = refreshed;
        try {
            await refreshed;
        } catch (e) {
            if (this.entries.get(storyId) === entry) await this.evict(storyId);
            throw e;
        }
    }

    async evictIdle(now = Date.now()): Promise<string[]> {
        const idle = [...this.entries].filter(
            ([, e]) =>
                e.ctx !== null &&
                e.active === 0 &&
                e.ctx.bus.listenerCount === 0 &&
                now - e.lastUsed >= this.options.idleMs
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
        const entry: TEntry = {
            ready: this.load(storyId, loaded),
            loaded,
            ctx: null,
            active: 0,
            lastUsed: Date.now(),
            close: async () => {
                // wait for a load in progress, so its watcher is not left running
                await entry.ready.catch(() => undefined);
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
        const project = new ProjectRoot(this.folders.dir(storyId), storyId);
        await mkdir(project.root, { recursive: true });
        await migrateStoryTsconfig(project.root);
        const bus = new EventBus({ project, batchMs: this.options.batchMs });
        loaded.bus = bus;
        const sp = SourceProject.for(project);
        sp.onFirstRun(() => migrateStructureLayout(sp, bus));
        if (this.options.watch) loaded.watcher = await startWatcher(bus);
        return { storyId, project, sp, bus, watching: () => loaded.watcher !== null };
    }

    // the same context, so open event streams keep their bus; SourceProject re-reads changed files by itself
    private async refresh(ctx: TServerContext, loaded: TLoaded): Promise<TServerContext> {
        await migrateStoryTsconfig(ctx.project.root);
        ctx.sp.onFirstRun(() => migrateStructureLayout(ctx.sp, ctx.bus));
        if (loaded.watcher) {
            await loaded.watcher.close();
            loaded.watcher = await startWatcher(ctx.bus);
        }
        return ctx;
    }
}
