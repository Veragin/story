import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export const $ = <T extends Element = HTMLElement>(selector: string) =>
    document.querySelector<T & HTMLElement>(selector);

export const $$ = <T extends Element = HTMLElement>(selector: string) => [
    ...document.querySelectorAll<T & HTMLElement>(selector),
];

/** The element, or a failed test naming the selector. */
export const get = <T extends Element = HTMLElement>(selector: string) => {
    const el = $<T>(selector);
    if (!el) throw new Error(`No element matches ${selector}`);
    return el;
};

// React tracks the value itself: set it through the native setter, then fire `input`
export const typeInto = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    act(() => {
        el.focus();
        setter?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
};

export const selectOption = (el: HTMLSelectElement, value: string) =>
    act(() => {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });

export const fire = (el: Element, event: Event) =>
    act(() => {
        el.dispatchEvent(event);
    });

export const click = (selector: string) => {
    const el = get(selector);
    act(() => el.click());
};

/** Lets pending promise callbacks (an async create, a load) run and render. */
export const flush = () => act(() => Promise.resolve());

let root: Root | null = null;

export const mount = (node: ReactNode) => {
    const container = document.body.appendChild(document.createElement('div'));
    const created = createRoot(container);
    root = created;
    act(() => created.render(node));
};

export const mountAsync = async (node: ReactNode) => {
    const container = document.body.appendChild(document.createElement('div'));
    const created = createRoot(container);
    root = created;
    await act(() => Promise.resolve(created.render(node)));
};

export const unmount = () => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
};
