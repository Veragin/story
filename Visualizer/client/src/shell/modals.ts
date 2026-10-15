import { createElement, ReactNode } from 'react';
import { action, computed, makeObservable, observable } from 'mobx';
import { ConfirmDialog } from './ConfirmDialog';

export type TModalRender = (close: () => void) => ReactNode;

export type TConfirmOptions = {
    title: string;
    message?: ReactNode;
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

export const modals = new ModalStore();
