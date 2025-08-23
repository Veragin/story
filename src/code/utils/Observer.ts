export type Listener<T> = (data: T) => void;

export class Observer<T> {
    private listeners: Set<Listener<T>> = new Set();

    // Subscribe a listener to the chapter
    public subscribe(listener: Listener<T>): void {
        this.listeners.add(listener);
    }

    // Unsubscribe a listener from the chapter
    public unsubscribe(listener: Listener<T>): void {
        this.listeners.delete(listener);
    }

    // Notify all subscribed listeners with data
    public notify(data: T): void {
        this.listeners.forEach(listener => listener(data));
    }
}

type ShouldNotifyCheck<T> = (newValue: T, lastValue: T | undefined) => boolean;

/**
 * Observer that only notifies listeners when a certain condition is met
 */
export class ConditionalObserver<T> extends Observer<T> {
    private lastValue: T | undefined;
    private hasLastValue: boolean = false;
    private shouldNotifyCheck: ShouldNotifyCheck<T>;

    constructor(shouldNotifyCheck: ShouldNotifyCheck<T>) {
        super();
        this.shouldNotifyCheck = shouldNotifyCheck;
    }

    // Override the notify method to include the conditional check
    public notify(data: T): void {
        if (this.shouldNotifyCheck(data, this.hasLastValue ? this.lastValue : undefined)) {
            this.lastValue = data;
            this.hasLastValue = true;
            super.notify(data);
        }
    }

    // Force notification without check
    public forceNotify(data: T): void {
        this.lastValue = data;
        this.hasLastValue = true;
        super.notify(data);
    }

    // Get the last value that was actually notified
    public getLastValue(): T | undefined {
        return this.lastValue;
    }

    // Reset the stored value
    public reset(): void {
        this.lastValue = undefined;
        this.hasLastValue = false;
    }
}