import { action, makeObservable, observable } from 'mobx';

export class ShellStore {
    controlBarEl: HTMLElement | null = null;

    constructor() {
        makeObservable(this, {
            controlBarEl: observable.ref,
            setControlBarEl: action,
        });
    }

    setControlBarEl = (el: HTMLElement | null) => {
        this.controlBarEl = el;
    };
}

export const shell = new ShellStore();
