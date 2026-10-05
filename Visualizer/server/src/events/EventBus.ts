import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { TChangeEvent } from '@story/visualizer-protocol';
import { atomicWrite } from '../json/atomicWrite';
import type { ProjectRoot } from '../project/ProjectRoot';
import { passageLocalIdOf } from './passageLocalId';
import { localIdFromPassageFile, pathToResources, resourceKey, type TResourceRef } from './pathToEvent';
import { version } from './version';

type TChangeListener = (event: TChangeEvent) => void;

export type TTransaction = {
    readonly project: ProjectRoot;
    writeFile(file: string, contents: string | Uint8Array): Promise<void>;
    deleteFile(file: string): Promise<void>;
    deleteDir(dir: string): Promise<void>;
    // for files saved by something else (e.g. a library), so the watcher ignores them
    expect(file: string, contents: string | null): void;
    // replaces any earlier call: a transaction emits at most one event
    setEvent(event: TChangeEvent): void;
};

type TEventBusOptions = {
    project: ProjectRoot;
    batchMs?: number;
    suppressMs?: number;
};

type TSuppression = { hash: string | null; until: number };

export class EventBus {
    readonly project: ProjectRoot;
    private readonly batchMs: number;
    private readonly suppressMs: number;

    private listeners = new Set<TChangeListener>();
    private suppressed = new Map<string, TSuppression>();
    private pending = new Map<string, 'add' | 'change' | 'unlink'>();
    private batchTimer: NodeJS.Timeout | null = null;
    private flushing: Promise<void> | null = null;
    // last parsed id per passage file, so an unlink still reports the id the file had
    private passageIds = new Map<string, string>();
    private activeTransactions = 0;
    private txQueue: Promise<unknown> = Promise.resolve();
    private closed = false;

    // suppressMs is generous on purpose: chokidar reports a write within a few ms
    constructor({ project, batchMs = 150, suppressMs = 5000 }: TEventBusOptions) {
        this.project = project;
        this.batchMs = batchMs;
        this.suppressMs = suppressMs;
    }

    subscribe(listener: TChangeListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    get listenerCount() {
        return this.listeners.size;
    }

    emit(event: TChangeEvent) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (e) {
                console.error('[visualizer-server] event listener failed', e);
            }
        }
    }

    transaction<T>(fn: (tx: TTransaction) => Promise<T>): Promise<T> {
        const run = async () => {
            this.activeTransactions++;
            const recorded = new Map<string, string | null>();
            let event: TChangeEvent | null = null;
            const record = (file: string, contents: string | Uint8Array | null) => {
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

    fileChanged(file: string, kind: 'add' | 'change' | 'unlink' = 'change') {
        if (this.closed) return;
        const abs = path.resolve(file);
        const previous = this.pending.get(abs);
        // a change after an add in the same batch is still a creation
        this.pending.set(abs, previous === 'add' && kind === 'change' ? 'add' : kind);
        this.scheduleFlush();
    }

    private scheduleFlush() {
        if (this.batchTimer || this.closed) return;
        this.batchTimer = setTimeout(() => {
            this.batchTimer = null;
            if (this.activeTransactions > 0) return; // re-scheduled when the last one ends
            if (this.flushing) return; // re-scheduled when the running flush ends
            this.flushing = this.flushBatch().finally(() => {
                this.flushing = null;
                if (this.pending.size > 0) this.scheduleFlush();
            });
        }, this.batchMs);
    }

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

            for (const found of pathToResources(this.project.rel(abs))) {
                const ref = found.kind === 'passage' ? this.passageRef(abs, found, contents) : found;
                const key = resourceKey(ref);
                if (!events.has(key)) events.set(key, toEvent(ref, hash, change));
            }
        }
        for (const event of events.values()) this.emit(event);
    }

    // the served id comes from the file's `id` literal, not its file name
    private passageRef(abs: string, ref: TResourceRef, contents: Buffer | null): TResourceRef {
        const fileLocalId = localIdFromPassageFile(path.basename(abs));
        const prefix = ref.id.slice(0, ref.id.length - fileLocalId.length);
        let localId: string | undefined;
        if (contents === null) {
            localId = this.passageIds.get(abs);
            this.passageIds.delete(abs);
        } else {
            try {
                localId = passageLocalIdOf(abs, contents.toString('utf8'));
                this.passageIds.set(abs, localId);
            } catch {
                localId = undefined;
            }
        }
        return localId === undefined ? ref : { ...ref, id: prefix + localId };
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
        // a secondary file going away does not delete the resource
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
