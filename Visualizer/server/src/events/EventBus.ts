import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { TChangeEvent } from '@story/visualizer-protocol';
import { atomicWrite } from '../json/atomicWrite';
import type { ProjectRoot } from '../project/ProjectRoot';
import { pathToResource, resourceKey, type TResourceRef } from './pathToEvent';
import { version } from './version';

export type TChangeListener = (event: TChangeEvent) => void;

/** What a `bus.transaction` callback gets: the only way server code should touch the disk. */
export type TTransaction = {
    /** The project the bus writes to (so helpers like `json/index.ts#removePassagePositions` need only `tx`). */
    readonly project: ProjectRoot;
    /** Atomic write (tmp + rename) that the watcher will not echo back. */
    writeFile(file: string, contents: string): Promise<void>;
    /** Delete a file (missing is fine). */
    deleteFile(file: string): Promise<void>;
    /** Delete a directory and everything in it (a `<character>.passages/` folder). */
    deleteDir(dir: string): Promise<void>;
    /**
     * Declare a change made some other way (e.g. a library that saved a file itself) so the
     * watcher ignores it. `contents: null` means "the file will not exist".
     */
    expect(file: string, contents: string | null): void;
    /**
     * The single event this operation emits once it commits. Calling it again replaces the
     * event: a transaction emits at most one (plan §3 "Live refresh", point 2).
     */
    setEvent(event: TChangeEvent): void;
};

export type TEventBusOptions = {
    project: ProjectRoot;
    /** Window over which hand edits are collected into one batch. */
    batchMs?: number;
    /**
     * How long after a transaction commits the watcher keeps ignoring the files it wrote, as long
     * as their content is still what the transaction wrote. Chokidar reports a write within a few
     * ms, so this is generous on purpose.
     */
    suppressMs?: number;
};

type TSuppression = { hash: string | null; until: number };

/**
 * The server's change feed (plan §3 "Live refresh", point 2).
 *
 *  - **Hand edits**: the watcher (see `watcher.ts`) calls `fileChanged` for every file under
 *    `data/` and `types/`. Changes are collected for `batchMs` (~150 ms), mapped to resources
 *    (`pathToResource`), deduplicated, and emitted as one `TChangeEvent` per resource, with the
 *    changed file's content hash as `version`.
 *  - **Server writes**: go through `transaction`. Transactions run one at a time; every file one
 *    writes is recorded with the hash of what it wrote, and the watcher drops those changes. On
 *    commit the transaction emits *exactly one* event — the one set with `tx.setEvent`. If the
 *    callback throws, nothing is emitted and the suppressions are dropped, so whatever did reach
 *    the disk is reported by the watcher like a hand edit.
 */
export class EventBus {
    readonly project: ProjectRoot;
    private readonly batchMs: number;
    private readonly suppressMs: number;

    private listeners = new Set<TChangeListener>();
    private suppressed = new Map<string, TSuppression>();
    private pending = new Map<string, 'add' | 'change' | 'unlink'>();
    private batchTimer: NodeJS.Timeout | null = null;
    private flushing: Promise<void> | null = null;
    private activeTransactions = 0;
    private txQueue: Promise<unknown> = Promise.resolve();
    private closed = false;

    constructor({ project, batchMs = 150, suppressMs = 5000 }: TEventBusOptions) {
        this.project = project;
        this.batchMs = batchMs;
        this.suppressMs = suppressMs;
    }

    /** Listen to every emitted event. Returns the unsubscribe function. */
    subscribe(listener: TChangeListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    get listenerCount() {
        return this.listeners.size;
    }

    /** Emit right away, bypassing batching (prefer `transaction`). */
    emit(event: TChangeEvent) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (e) {
                console.error('[visualizer-server] event listener failed', e);
            }
        }
    }

    /**
     * Run a multi-file write as one operation that emits one event:
     *
     *     const dto = await bus.transaction(async (tx) => {
     *         await tx.writeFile(chapterFile, chapterSource);
     *         await tx.writeFile(registerFile, registerSource);
     *         tx.setEvent({ kind: 'chapter', id: chapterId, version: version(chapterSource), op: 'created' });
     *         return readChapter(chapterId);
     *     });
     */
    transaction<T>(fn: (tx: TTransaction) => Promise<T>): Promise<T> {
        const run = async () => {
            this.activeTransactions++;
            const recorded = new Map<string, string | null>();
            let event: TChangeEvent | null = null;
            const record = (file: string, contents: string | null) => {
                const abs = path.resolve(file);
                const hash = contents === null ? null : version(contents);
                recorded.set(abs, hash);
                this.suppressed.set(abs, { hash, until: Number.POSITIVE_INFINITY });
            };
            const tx: TTransaction = {
                project: this.project,
                writeFile: async (file, contents) => {
                    record(file, contents);
                    await atomicWrite(file, contents);
                },
                deleteFile: async (file) => {
                    record(file, null);
                    await rm(file, { force: true });
                },
                deleteDir: async (dir) => {
                    for (const file of await listFilesRecursive(dir)) record(file, null);
                    record(dir, null);
                    await rm(dir, { recursive: true, force: true });
                },
                expect: (file, contents) => record(file, contents),
                setEvent: (e) => {
                    event = e;
                },
            };
            try {
                const result = await fn(tx);
                const until = Date.now() + this.suppressMs;
                for (const [abs, hash] of recorded) this.suppressed.set(abs, { hash, until });
                if (event) this.emit(event);
                return result;
            } catch (e) {
                for (const abs of recorded.keys()) this.suppressed.delete(abs);
                throw e;
            } finally {
                this.activeTransactions--;
                if (this.activeTransactions === 0 && this.pending.size > 0) this.scheduleFlush();
            }
        };
        const result = this.txQueue.then(run, run);
        this.txQueue = result.catch(() => undefined);
        return result;
    }

    /** Called by the watcher for every add / change / unlink of a file. */
    fileChanged(file: string, kind: 'add' | 'change' | 'unlink' = 'change') {
        if (this.closed) return;
        const abs = path.resolve(file);
        const previous = this.pending.get(abs);
        // add followed by unlink within one batch is a no-op the flush will see as "missing"
        this.pending.set(abs, previous === 'add' && kind === 'change' ? 'add' : kind);
        this.scheduleFlush();
    }

    private scheduleFlush() {
        if (this.batchTimer || this.closed) return;
        this.batchTimer = setTimeout(() => {
            this.batchTimer = null;
            if (this.activeTransactions > 0) return; // re-scheduled when the last one ends
            this.flushing = this.flushBatch().finally(() => {
                this.flushing = null;
            });
        }, this.batchMs);
    }

    /** Wait for the current batch window (tests). */
    async settle(): Promise<void> {
        while (this.batchTimer || this.flushing || this.activeTransactions > 0) {
            if (this.flushing) await this.flushing;
            else await new Promise((r) => setTimeout(r, Math.max(10, this.batchMs / 3)));
        }
    }

    private async flushBatch() {
        const batch = this.pending;
        this.pending = new Map();
        const now = Date.now();
        for (const [abs, s] of this.suppressed) if (s.until < now) this.suppressed.delete(abs);

        const events = new Map<string, TChangeEvent>();
        for (const [abs, change] of batch) {
            let contents: Buffer | null = null;
            try {
                contents = await readFile(abs);
            } catch {
                contents = null;
            }
            const hash = contents === null ? null : version(contents);
            const suppression = this.suppressed.get(abs);
            if (suppression && suppression.hash === hash) continue;

            const ref = pathToResource(this.project.rel(abs));
            if (!ref) continue;
            const key = resourceKey(ref);
            if (events.has(key)) continue;
            events.set(key, toEvent(ref, hash, change));
        }
        for (const event of events.values()) this.emit(event);
    }

    async close() {
        this.closed = true;
        if (this.batchTimer) clearTimeout(this.batchTimer);
        this.batchTimer = null;
        this.listeners.clear();
        await this.flushing;
    }
}

const toEvent = (ref: TResourceRef, hash: string | null, change: 'add' | 'change' | 'unlink'): TChangeEvent => {
    const { primary, ...rest } = ref;
    if (!primary) {
        // a secondary file changed (or went away): the resource itself is still there
        return { ...rest, version: hash ?? '', op: 'updated' };
    }
    if (hash === null) return { ...rest, version: null, op: 'deleted' };
    return { ...rest, version: hash, op: change === 'add' ? 'created' : 'updated' };
};

const listFilesRecursive = async (dir: string): Promise<string[]> => {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const files: string[] = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...(await listFilesRecursive(full)));
        else files.push(full);
    }
    return files;
};
