export type TEventSourceLike = Pick<EventSource, 'addEventListener' | 'close' | 'readyState'> & {
    onerror: ((this: EventSource, ev: Event) => unknown) | null;
};

export type TCreateEventSource = (url: string) => TEventSourceLike;

export type TReconnectingEventSourceOptions = {
    url: string;
    createEventSource: TCreateEventSource;
    reconnectMinMs: number;
    reconnectMaxMs: number;
    onConnecting: () => void;
    listen: (source: TEventSourceLike) => void;
    onReconnecting: () => void;
    onGiveUp?: () => void;
};

const EVENT_SOURCE_CLOSED = 2;

export const defaultCreateEventSource = (): TCreateEventSource | undefined =>
    typeof EventSource === 'undefined' ? undefined : (url) => new EventSource(url);

export const eventData = (e: Event): unknown => {
    if (!('data' in e) || typeof e.data !== 'string') return undefined;
    try {
        return JSON.parse(e.data);
    } catch {
        return undefined;
    }
};

export class ReconnectingEventSource {
    private source: TEventSourceLike | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay: number;

    constructor(private readonly options: TReconnectingEventSourceOptions) {
        this.reconnectDelay = options.reconnectMinMs;
    }

    connect() {
        if (this.source || this.reconnectTimer) return;
        const { url, createEventSource, onConnecting, listen } = this.options;
        onConnecting();
        const source = createEventSource(url);
        this.source = source;
        listen(source);
        source.onerror = () => {
            if (this.source !== source) return;
            // while CONNECTING the browser retries by itself; CLOSED means it gave up
            if (source.readyState === EVENT_SOURCE_CLOSED) {
                source.close();
                this.source = null;
                this.options.onReconnecting();
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    this.connect();
                }, this.reconnectDelay);
                this.reconnectDelay = Math.min(this.options.reconnectMaxMs, this.reconnectDelay * 2);
                this.options.onGiveUp?.();
            } else {
                this.options.onReconnecting();
            }
        };
    }

    resetBackoff() {
        this.reconnectDelay = this.options.reconnectMinMs;
    }

    reconnectNow() {
        if (!this.reconnectTimer) return;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.resetBackoff();
        this.connect();
    }

    close() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.source?.close();
        this.source = null;
    }
}
