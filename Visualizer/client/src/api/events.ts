import { ROUTES, SSE_EVENT, type TChangeEvent, type TResourceKind, type TVersion } from '@story/visualizer-protocol';

/**
 * Which change events a subscriber wants. `kind: '*'` is everything. `id` narrows to one resource
 * (wildcard events such as `trigger` `*` or `entity` `items/*` still match). `chapterId` narrows to
 * events scoped to one chapter.
 */
export type TEventFilter = {
    kind: TResourceKind | '*';
    id?: string;
    chapterId?: string;
};

export type TEventListener = (event: TChangeEvent) => void;
export type TConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

type TEventSourceLike = Pick<EventSource, 'addEventListener' | 'close' | 'readyState'> & {
    onerror: ((this: EventSource, ev: Event) => unknown) | null;
};

export type TApiEventsOptions = {
    url?: string;
    /**
     * Injected for tests; defaults to the browser `EventSource` (absent → events are a no-op).
     * `null` never opens a stream (mock mode). Note that `undefined` means "use the default".
     */
    createEventSource?: ((url: string) => TEventSourceLike) | null;
    /** How long a version passed to `markSaved` is remembered. */
    savedTtlMs?: number;
    /** Backoff for re-creating a stream the browser gave up on. */
    reconnectMinMs?: number;
    reconnectMaxMs?: number;
};

export const matchesFilter = (filter: TEventFilter, event: TChangeEvent): boolean => {
    if (filter.kind !== '*' && filter.kind !== event.kind) return false;
    if (filter.chapterId !== undefined && event.chapterId !== undefined && filter.chapterId !== event.chapterId) {
        return false;
    }
    if (filter.id === undefined || filter.id === event.id || event.id === '*') return true;
    if (event.id.endsWith('/*')) return filter.id.startsWith(event.id.slice(0, -1));
    return false;
};

/**
 * The client end of `GET /api/events` (plan §3 "Live refresh", points 2–3).
 *
 *     // a store keeps its resource fresh:
 *     const off = apiEvents.subscribe({ kind: 'passage', id: passageId }, () => this.refetch());
 *     // after a real reconnect you may have missed events — refetch what is on screen:
 *     const offResync = apiEvents.onResync(() => this.refetch());
 *
 * Own saves are not echoed: the http api calls `markSaved(version)` for every resource a mutation
 * returns, and an event carrying one of those versions is dropped (once). The stream is opened
 * lazily by the first `subscribe` and re-created with backoff when the browser gives up on it
 * (e.g. the proxy answers 502 while the server restarts under `tsx watch`).
 */
export class ApiEvents {
    private readonly url: string;
    private readonly createEventSource?: (url: string) => TEventSourceLike;
    private readonly savedTtlMs: number;
    private readonly reconnectMinMs: number;
    private readonly reconnectMaxMs: number;

    private source: TEventSourceLike | null = null;
    private listeners = new Set<{ filter: TEventFilter; listener: TEventListener }>();
    private resyncListeners = new Set<() => void>();
    private statusListeners = new Set<(status: TConnectionStatus) => void>();
    private saved = new Map<TVersion, number>();
    private connectedOnce = false;
    private reconnectDelay: number;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private _status: TConnectionStatus = 'idle';

    constructor({
        url = ROUTES.events.path,
        createEventSource = typeof EventSource === 'undefined' ? undefined : (u) => new EventSource(u),
        savedTtlMs = 30_000,
        reconnectMinMs = 1000,
        reconnectMaxMs = 15_000,
    }: TApiEventsOptions = {}) {
        this.url = url;
        this.createEventSource = createEventSource ?? undefined;
        this.savedTtlMs = savedTtlMs;
        this.reconnectMinMs = reconnectMinMs;
        this.reconnectMaxMs = reconnectMaxMs;
        this.reconnectDelay = reconnectMinMs;
    }

    get status() {
        return this._status;
    }

    /** Subscribe to events of a kind (`'passage'`) or matching a filter. Returns the unsubscribe. */
    subscribe(filter: TEventFilter | TResourceKind | '*', listener: TEventListener): () => void {
        const entry = { filter: typeof filter === 'string' ? { kind: filter } : filter, listener };
        this.listeners.add(entry);
        this.connect();
        return () => {
            this.listeners.delete(entry);
        };
    }

    /** Called after a reconnect (not the first connect): events may have been missed. */
    onResync(listener: () => void): () => void {
        this.resyncListeners.add(listener);
        return () => {
            this.resyncListeners.delete(listener);
        };
    }

    onStatus(listener: (status: TConnectionStatus) => void): () => void {
        this.statusListeners.add(listener);
        return () => {
            this.statusListeners.delete(listener);
        };
    }

    /** Remember a version this client just wrote, so its echo event is ignored. */
    markSaved(version: TVersion) {
        this.saved.set(version, Date.now() + this.savedTtlMs);
    }

    /** Deliver an event to the subscribers (the SSE stream and `mockApi` both come through here). */
    dispatch(event: TChangeEvent) {
        const now = Date.now();
        for (const [v, until] of this.saved) if (until < now) this.saved.delete(v);
        if (event.version && this.saved.has(event.version)) {
            this.saved.delete(event.version);
            return;
        }
        for (const { filter, listener } of [...this.listeners]) {
            if (!matchesFilter(filter, event)) continue;
            try {
                listener(event);
            } catch (e) {
                console.error('[api/events] listener failed', e);
            }
        }
    }

    /** Open the stream (idempotent; `subscribe` calls it). */
    connect() {
        if (this.source || this.reconnectTimer || !this.createEventSource) return;
        this.setStatus(this.connectedOnce ? 'reconnecting' : 'connecting');
        const source = this.createEventSource(this.url);
        this.source = source;

        source.addEventListener(SSE_EVENT.hello, () => {
            this.reconnectDelay = this.reconnectMinMs;
            this.setStatus('open');
            if (this.connectedOnce) this.resyncListeners.forEach((l) => l());
            this.connectedOnce = true;
        });
        source.addEventListener(SSE_EVENT.change, (e) => {
            try {
                this.dispatch(JSON.parse((e as MessageEvent<string>).data) as TChangeEvent);
            } catch (err) {
                console.error('[api/events] bad event', err);
            }
        });
        source.onerror = () => {
            // CONNECTING: the browser retries by itself (the server sent `retry:`).
            // CLOSED: it gave up (non-200 answer) — re-create it ourselves, with backoff.
            if (source.readyState === 2 /* CLOSED */) {
                source.close();
                this.source = null;
                this.setStatus('reconnecting');
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    this.connect();
                }, this.reconnectDelay);
                this.reconnectDelay = Math.min(this.reconnectMaxMs, this.reconnectDelay * 2);
            } else {
                this.setStatus('reconnecting');
            }
        };
    }

    close() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.source?.close();
        this.source = null;
        this.setStatus('idle');
    }

    private setStatus(status: TConnectionStatus) {
        if (status === this._status) return;
        this._status = status;
        this.statusListeners.forEach((l) => l(status));
    }
}
