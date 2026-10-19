type TOff = () => void;

export class RefCountedSubscription {
    private count = 0;
    private offs: TOff[] = [];

    constructor(private readonly subscribe: () => TOff[]) {}

    get active(): boolean {
        return this.count > 0;
    }

    acquire = (): TOff => {
        if (this.count++ === 0) this.offs = this.subscribe();
        let released = false;
        return () => {
            if (released) return;
            released = true;
            if (--this.count === 0) this.offs.splice(0).forEach((off) => off());
        };
    };
}
