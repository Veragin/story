import { buildPath, SSE_EVENT, type TChangeEvent, type TResourceKind, type TVersion } from '@story/visualizer-protocol';
import { STORY_ID } from './story';

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
    // `null` never opens a stream; `undefined` means the browser default
    createEventSource?: ((url: string) => TEventSourceLike) | null;
    savedTtlMs?: number;
    holdMaxMs?: number;
    reconnectMinMs?: number;
    reconnectMaxMs?: number;
    onGiveUp?: () => void;
};

const EVENT_SOURCE_CLOSED = 2;

const addTo = <T>(set: Set<T>, entry: T): (() => void) => {
    set.add(entry);
    return () => {
        set.delete(entry);
    };
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

export class ApiEvents {
    private readonly url: string;
    private readonly createEventSource?: (url: string) => TEventSourceLike;
    private readonly savedTtlMs: number;
    private readonly reconnectMinMs: number;
    private readonly reconnectMaxMs: number;
    private readonly onGiveUp?: () => void;

    private source: TEventSourceLike | null = null;
    private listeners = new Set<{ filter: TEventFilter; listener: TEventListener }>();
    private resyncListeners = new Set<() => void>();
    private statusListeners = new Set<(status: TConnectionStatus) => void>();
    private saved = new Map<TVersion, number>();
    private readonly holdMaxMs: number;
    private holds = 0;
    private held: TChangeEvent[] = [];
    private connectedOnce = false;
    private reconnectDelay: number;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private _status: TConnectionStatus = 'idle';

    constructor({
        url = buildPath(STORY_ID, 'events', {}),
        createEventSource = typeof EventSource === 'undefined' ? undefined : (u) => new EventSource(u),
        savedTtlMs = 30_000,
        holdMaxMs = 30_000,
        reconnectMinMs = 1000,
        reconnectMaxMs = 15_000,
        onGiveUp,
    }: TApiEventsOptions = {}) {
        this.url = url;
        this.onGiveUp = onGiveUp;
        this.createEventSource = createEventSource ?? undefined;
        this.savedTtlMs = savedTtlMs;
        this.holdMaxMs = holdMaxMs;
        this.reconnectMinMs = reconnectMinMs;
        this.reconnectMaxMs = reconnectMaxMs;
        this.reconnectDelay = reconnectMinMs;
    }

    get status() {
        return this._status;
    }

    subscribe(filter: TEventFilter | TResourceKind | '*', listener: TEventListener): () => void {
        const entry = { filter: typeof filter === 'string' ? { kind: filter } : filter, listener };
        const unsubscribe = addTo(this.listeners, entry);
        this.connect();
        return unsubscribe;
    }

    onResync(listener: () => void): () => void {
        return addTo(this.resyncListeners, listener);
    }

    onStatus(listener: (status: TConnectionStatus) => void): () => void {
        return addTo(this.statusListeners, listener);
    }

    markSaved(version: TVersion) {
        this.saved.set(version, Date.now() + this.savedTtlMs);
    }

    // a save's echo can beat its response, so events wait until `markSaved` has the version
    hold(): () => void {
        this.holds++;
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            clearTimeout(timer);
            this.holds--;
            if (this.holds > 0) return;
            const held = this.held;
            this.held = [];
            held.forEach((e) => this.dispatch(e));
        };
        const timer = setTimeout(release, this.holdMaxMs);
        return release;
    }

    dispatch(event: TChangeEvent) {
        if (this.holds > 0) {
            this.held.push(event);
            return;
        }
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
            if (this.source !== source) return;
            // while CONNECTING the browser retries by itself; CLOSED means it gave up
            if (source.readyState === EVENT_SOURCE_CLOSED) {
                source.close();
                this.source = null;
                this.setStatus('reconnecting');
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    this.connect();
                }, this.reconnectDelay);
                this.reconnectDelay = Math.min(this.reconnectMaxMs, this.reconnectDelay * 2);
                this.onGiveUp?.();
            } else {
                this.setStatus('reconnecting');
            }
        };
    }

    reconnectNow() {
        if (!this.reconnectTimer) return;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.reconnectDelay = this.reconnectMinMs;
        this.connect();
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
