export class Emitter<TEvents extends { [K in keyof TEvents]: unknown }> {
    private listeners = new Map<keyof TEvents, Set<(payload: never) => void>>();

    on<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): () => void {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(listener as (payload: never) => void);
        return () => this.off(event, listener);
    }

    off<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): void {
        this.listeners.get(event)?.delete(listener as (payload: never) => void);
    }

    emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
        const set = this.listeners.get(event);
        if (!set) return;
        for (const listener of [...set]) {
            (listener as (payload: TEvents[K]) => void)(payload);
        }
    }

    clear(): void {
        this.listeners.clear();
    }
}
