import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import chokidar, { type FSWatcher } from 'chokidar';
import { Observable, Subject } from 'rxjs';
import { SourceFileService } from '../story/SourceFileService';
import { StoryIndexService } from '../story/StoryIndexService';

/**
 * Watches `data/` and `types/` and turns changes into invalidations plus an event stream
 * (VISUALIZER_PLAN §5.1, §5.3 `GET /api/events`).
 *
 * ## Why this exists at all
 *
 * `POST …/open` sends the author to their editor (§5.3), so hand-edits are not an edge case —
 * they are a designed-for workflow. Without a watcher the client would keep showing the state
 * the file had when it was last fetched, and the author's next save through the UI would
 * silently overwrite what they just typed in VS Code. The watcher is half the answer; `If-Match`
 * (Phase 5) is the other half, for the race the watcher cannot win.
 *
 * ## Self-writes are suppressed
 *
 * When the server writes a file it tells the watcher to ignore the next event for that path.
 * Otherwise every save would bounce straight back to the client as "changed on disk", the client
 * would refetch, and an author dragging a location would get their canvas reset mid-gesture.
 * The suppression is by path with a short expiry rather than a flag, because chokidar may
 * coalesce or delay, and a permanently-set flag would mean a genuine external edit arriving a
 * second later is swallowed too.
 */

export type TFileChangeEvent = {
    type: 'changed';
    /** Repo-relative path. */
    path: string;
    kind: 'add' | 'change' | 'unlink';
};

/** How long a self-write stays suppressed. Long enough for chokidar's debounce, short enough
 *  that a real edit landing right after a save is not lost. */
const SUPPRESS_WINDOW_MS = 1500;

@Injectable()
export class FileWatcherService implements OnModuleInit, OnModuleDestroy {
    private watcher: FSWatcher | null = null;
    private readonly subject = new Subject<TFileChangeEvent>();
    private readonly suppressed = new Map<string, number>();

    constructor(
        private readonly files: SourceFileService,
        private readonly index: StoryIndexService
    ) {}

    onModuleInit(): void {
        this.watcher = chokidar.watch(this.files.watchRoots, {
            ignoreInitial: true,
            ignored: (path: string) => path.includes('node_modules') || path.includes('/.git/'),
            // Waiting for the file to stop growing: an editor that writes in chunks would
            // otherwise produce an event per chunk, and the first ones read a truncated file.
            awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 30 },
        });

        this.watcher.on('add', (path) => this.handle(path, 'add'));
        this.watcher.on('change', (path) => this.handle(path, 'change'));
        this.watcher.on('unlink', (path) => this.handle(path, 'unlink'));
    }

    async onModuleDestroy(): Promise<void> {
        await this.watcher?.close();
        this.watcher = null;
        this.subject.complete();
    }

    /** The SSE controller subscribes to this. */
    get changes(): Observable<TFileChangeEvent> {
        return this.subject.asObservable();
    }

    /**
     * Called by the writer immediately before it writes, so the resulting event is not echoed
     * back to the client that caused it.
     */
    suppressNext(repoRelativePath: string): void {
        this.suppressed.set(repoRelativePath, Date.now() + SUPPRESS_WINDOW_MS);
    }

    private handle(absolutePath: string, kind: TFileChangeEvent['kind']): void {
        const path = this.files.toRepoRelative(absolutePath);

        const until = this.suppressed.get(path);
        if (until !== undefined) {
            this.suppressed.delete(path);
            if (Date.now() <= until) {
                // Our own write. The index still has to be dropped — the file on disk is no
                // longer what was cached — but no client is told, because the client that
                // caused it already has the new value in its response.
                this.index.invalidate();
                return;
            }
        }

        this.pruneSuppressed();
        this.index.invalidate();
        this.subject.next({ type: 'changed', path, kind });
    }

    /** Drops expired suppressions, so a write that never produced an event cannot leak. */
    private pruneSuppressed(): void {
        const now = Date.now();
        for (const [path, until] of this.suppressed) {
            if (until < now) this.suppressed.delete(path);
        }
    }
}
