import { createElement, ReactNode } from 'react';
import { action, computed, makeObservable, observable } from 'mobx';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * App-wide modal stack. `<ModalHost/>` (rendered once by the shell) draws it.
 *
 *   const ok = await modals.confirm({ title: 'Delete chapter?', message: '…', danger: true });
 *
 *   const close = modals.open((close) => (
 *       <Modal open title={_('Edit location')} onClose={close}>
 *           <LocationForm onSaved={close} />
 *       </Modal>
 *   ));
 *
 * `open` does not add any chrome: the render function returns the whole modal (use `Modal` from
 * `@story/ui` or an MUI `Dialog`). It is called on every render of the host, so it may read
 * MobX observables. Close it with the `close` argument or the returned function.
 */

export type TModalRender = (close: () => void) => ReactNode;

export type TConfirmOptions = {
    title: string;
    message?: ReactNode;
    /** Red confirm button. */
    danger?: boolean;
    confirmLabel?: string;
    cancelLabel?: string;
};

export type TModalEntry = {
    id: number;
    render: TModalRender;
    close: () => void;
    onClose?: () => void;
};

export class ModalStore {
    stack: TModalEntry[] = [];
    private nextId = 1;

    constructor() {
        makeObservable(this, {
            stack: observable.shallow,
            isOpen: computed,
            open: action,
            close: action,
            closeAll: action,
        });
    }

    get isOpen() {
        return this.stack.length > 0;
    }

    /** Push a modal. Returns a function that closes it (safe to call twice). */
    open = (render: TModalRender, options: { onClose?: () => void } = {}): (() => void) => {
        const id = this.nextId++;
        const close = () => this.close(id);
        this.stack.push({ id, render, close, onClose: options.onClose });
        return close;
    };

    close = (id: number) => {
        const index = this.stack.findIndex((m) => m.id === id);
        if (index === -1) return;
        const [entry] = this.stack.splice(index, 1);
        entry.onClose?.();
    };

    closeAll = () => {
        [...this.stack].reverse().forEach((m) => this.close(m.id));
    };

    /** Yes/no dialog. Resolves `true` on confirm, `false` on cancel/escape/backdrop. */
    confirm = (options: TConfirmOptions): Promise<boolean> =>
        new Promise<boolean>((resolve) => {
            let result = false;
            this.open(
                (close) =>
                    createElement(ConfirmDialog, {
                        ...options,
                        onAnswer: (answer: boolean) => {
                            result = answer;
                            close();
                        },
                    }),
                { onClose: () => resolve(result) }
            );
        });
}

/** The app-wide modal store. */
export const modals = new ModalStore();
