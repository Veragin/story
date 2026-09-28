import { action, makeObservable, observable } from 'mobx';

/** Shell-wide UI state shared between the top bar and the pages. */
export class ShellStore {
    /** The DOM node of the control-bar slot, set by the top bar. */
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
