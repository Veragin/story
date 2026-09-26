/**
 * Minimal typed event emitter. `on` returns an unsubscribe function, so a React effect can
 * `return scene.events.on('change', fn)` directly.
 */
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

    once<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): () => void {
        const off = this.on(event, (payload) => {
            off();
            listener(payload);
        });
        return off;
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

    listenerCount(event: keyof TEvents): number {
        return this.listeners.get(event)?.size ?? 0;
    }

    clear(): void {
        this.listeners.clear();
    }
}
