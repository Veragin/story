type Listener<T> = (data: T) => void;

export class Observer<T> {
    private listeners: Set<Listener<T>> = new Set();

    // Subscribe a listener to the event
    public subscribe(listener: Listener<T>): void {
        this.listeners.add(listener);
    }

    // Unsubscribe a listener from the event
    public unsubscribe(listener: Listener<T>): void {
        this.listeners.delete(listener);
    }

    // Notify all subscribed listeners with data
    public notify(data: T): void {
        this.listeners.forEach(listener => listener(data));
    }
}
