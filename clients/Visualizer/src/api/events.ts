import {
    buildPath,
    SSE_EVENT,
    STORY_EVENT_REASONS,
    type TChangeEvent,
    type TResourceKind,
    type TStoryEvent,
    type TVersion,
} from '@story/protocol';
import {
    defaultCreateEventSource,
    eventData,
    ReconnectingEventSource,
    type TCreateEventSource,
} from './ReconnectingEventSource';
import { STORY_ID } from './story';

export type TEventFilter = {
    kind: TResourceKind | '*';
    id?: string;
    chapterId?: string;
};

export type TEventListener = (event: TChangeEvent) => void;
export type TConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

export type TApiEventsOptions = {
    url?: string;
    // `null` never opens a stream; `undefined` means the browser default
    createEventSource?: TCreateEventSource | null;
    savedTtlMs?: number;
    holdMaxMs?: number;
    reconnectMinMs?: number;
    reconnectMaxMs?: number;
    onGiveUp?: () => void;
};

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

const isStoryEvent = (value: unknown): value is TStoryEvent =>
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'story' &&
    'reason' in value &&
    STORY_EVENT_REASONS.some((reason) => reason === value.reason);

export class ApiEvents {
    private readonly savedTtlMs: number;
    private readonly stream: ReconnectingEventSource | null;

    private listeners = new Set<{ filter: TEventFilter; listener: TEventListener }>();
    private resyncListeners = new Set<() => void>();
    private statusListeners = new Set<(status: TConnectionStatus) => void>();
    private writeListeners = new Set<() => void>();
    private saved = new Map<TVersion, number>();
    private readonly holdMaxMs: number;
    private holds = 0;
    private held: TChangeEvent[] = [];
    private connectedOnce = false;
    private _status: TConnectionStatus = 'idle';

    constructor({
        url = buildPath(STORY_ID, 'events', {}),
        createEventSource = defaultCreateEventSource(),
        savedTtlMs = 30_000,
        holdMaxMs = 30_000,
        reconnectMinMs = 1000,
        reconnectMaxMs = 15_000,
        onGiveUp,
    }: TApiEventsOptions = {}) {
        this.savedTtlMs = savedTtlMs;
        this.holdMaxMs = holdMaxMs;
        this.stream = createEventSource
            ? new ReconnectingEventSource({
                  url,
                  createEventSource,
                  reconnectMinMs,
                  reconnectMaxMs,
                  onGiveUp,
                  onConnecting: () => this.setStatus(this.connectedOnce ? 'reconnecting' : 'connecting'),
                  onReconnecting: () => this.setStatus('reconnecting'),
                  listen: (source) => {
                      source.addEventListener(SSE_EVENT.hello, () => {
                          this.stream?.resetBackoff();
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
                      source.addEventListener(SSE_EVENT.story, (e) => {
                          const data = eventData(e);
                          if (isStoryEvent(data)) this.storyChanged();
                          else console.error('[api/events] bad story event', data);
                      });
                  },
              })
            : null;
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

    // own successful writes; their SSE echo is dropped, so it can't tell
    onWrite(listener: () => void): () => void {
        return addTo(this.writeListeners, listener);
    }

    notifyWrite() {
        this.writeListeners.forEach((l) => l());
    }

    // the whole story changed (a git pull or checkout): every store refetches as after a reconnect
    storyChanged() {
        this.resyncListeners.forEach((l) => l());
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
        this.stream?.connect();
    }

    reconnectNow() {
        this.stream?.reconnectNow();
    }

    close() {
        this.stream?.close();
        this.setStatus('idle');
    }

    private setStatus(status: TConnectionStatus) {
        if (status === this._status) return;
        this._status = status;
        this.statusListeners.forEach((l) => l(status));
    }
}
