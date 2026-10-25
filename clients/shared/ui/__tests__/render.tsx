import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

let root: Root | null = null;

export const render = (node: ReactNode) => {
    const container = document.body.appendChild(document.createElement('div'));
    const created = createRoot(container);
    root = created;
    act(() => created.render(node));
};

export const cleanup = () => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
};

export const element = <T extends Element>(
    selector: string,
    type: new () => T
): T => {
    const found = document.querySelector(selector);
    if (!(found instanceof type))
        throw new Error(`No ${type.name} matches ${selector}`);
    return found;
};

export const buttonByText = (text: string): HTMLButtonElement => {
    const found = [...document.querySelectorAll('button')].find(
        (b) => b.textContent === text
    );
    if (!found) throw new Error(`No button "${text}"`);
    return found;
};

// React tracks controlled values; the native setter makes the `input` event register
export const type = (selector: string, value: string) => {
    const el = document.querySelector(selector);
    if (
        !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    ) {
        throw new Error(`No input matches ${selector}`);
    }
    const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(el),
        'value'
    )?.set;
    act(() => {
        setter?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
};

export const click = async (button: HTMLElement) => {
    await act(() => Promise.resolve(button.click()));
};
